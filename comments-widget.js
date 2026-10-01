(() => {
  const SUPABASE_URL = 'https://djjedtojdxtpwtegmisu.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_8awsvNVZSEUvibbIvw3pEw_5Tbgo-mt';
  const PAGE_LIMIT = 10;
  const MAX_DEPTH = 2;
  const root = document.getElementById('comments-widget');
  if (!root) return;

  const $ = (id) => document.getElementById(`comments-${id}`);
  const toggle = $('toggle');
  const panel = $('panel');
  function wrapCommentHoverText(rootElement) {
    if (!rootElement) return;
    const walker = document.createTreeWalker(rootElement, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const parent = node.parentElement;
      if (!parent || !node.nodeValue.trim()) continue;
      if (parent.closest('.hover-char, button, textarea, input, script, style')) continue;
      textNodes.push(node);
    }
    for (const node of textNodes) {
      const fragment = document.createDocumentFragment();
      for (const char of node.nodeValue) {
        const span = document.createElement('span');
        span.className = 'hover-char';
        if (char === ' ') span.classList.add('whitespace');
        span.textContent = char;
        fragment.appendChild(span);
      }
      node.parentNode.replaceChild(fragment, node);
    }
  }

  function wrapCommentsText() {
    panel.querySelectorAll('h2, h3, label, #comments-user-info, #comments-status, #comments-list')
      .forEach(wrapCommentHoverText);
  }

  function setToggleText(label) {
    const fragment = document.createDocumentFragment();
    fragment.appendChild(document.createTextNode('[ '));

    const labelWrap = document.createElement('span');
    labelWrap.className = 'comments-toggle-label';
    for (const char of label) {
      const charSpan = document.createElement('span');
      charSpan.className = 'hover-char';
      if (char === ' ') {
        charSpan.classList.add('whitespace');
      }
      charSpan.textContent = char;
      labelWrap.appendChild(charSpan);
    }
    fragment.appendChild(labelWrap);
    fragment.appendChild(document.createTextNode(' ]'));
    toggle.replaceChildren(fragment);
  }

  toggle.addEventListener('click', () => {
    const opening = panel.hidden;
    panel.hidden = !opening;
    setToggleText(opening ? 'close comments' : 'show comments');
    toggle.setAttribute('aria-expanded', String(opening));
  });

  setToggleText('show comments');
  wrapCommentsText();

  if (!window.supabase) {
    $('status').textContent = 'The comments service failed to load. Check your connection or ad blocker.';
    return;
  }

  const userInfo = $('user-info');
  const authButton = $('auth');
  const form = $('form');
  const text = $('text');
  const formError = $('form-error');
  const postButton = $('post');
  const status = $('status');
  const list = $('list');
  const pager = $('pager');
  const pageInput = $('page-input');
  const pageTotal = $('page-total');
  const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const pageKey = location.pathname;
  let user = null;
  let comments = [];
  let currentPage = 1;
  let replyingTo = null;

  function displayName(account) {
    const meta = account.user_metadata || {};
    return meta.custom_claims?.global_name || meta.full_name || meta.name || 'Discord user';
  }

  function avatar(url, name) {
    const element = url ? document.createElement('img') : document.createElement('span');
    element.className = 'comments-avatar';
    if (url) {
      element.src = url;
      element.alt = name;
    } else {
      element.textContent = (name || '?').charAt(0).toUpperCase();
    }
    return element;
  }

  function timeAgo(iso) {
    const seconds = Math.floor((Date.now() - new Date(iso)) / 1000);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return new Date(iso).toLocaleDateString();
  }

  function paginate() {
    const children = new Map();
    comments.forEach((comment) => {
      const parent = comment.parent_id ?? 0;
      if (!children.has(parent)) children.set(parent, []);
      children.get(parent).push(comment);
    });
    const byDate = (a, b) => new Date(a.created_at) - new Date(b.created_at);
    const pages = [];
    let current = [];
    const walk = (id, depth, thread) => {
      (children.get(id) || []).slice().sort(byDate).forEach((comment) => {
        thread.push({ comment, depth });
        walk(comment.id, depth + 1, thread);
      });
    };
    (children.get(0) || []).slice().sort((a, b) => byDate(b, a)).forEach((comment) => {
      const thread = [{ comment, depth: 0 }];
      walk(comment.id, 1, thread);
      if (current.length && current.length + thread.length > PAGE_LIMIT) {
        pages.push(current);
        current = [];
      }
      current.push(...thread);
    });
    if (current.length) pages.push(current);
    return pages;
  }

  function makeButton(label, className, onClick, type = 'button') {
    const button = document.createElement('button');
    button.type = type;
    button.className = className || '';
    button.textContent = label;
    if (onClick) button.addEventListener('click', onClick);
    return button;
  }

  function addReplyForm(card, comment) {
    const replyForm = document.createElement('form');
    replyForm.className = 'comments-reply-form';
    const field = document.createElement('textarea');
    field.rows = 2;
    field.maxLength = 1000;
    field.required = true;
    field.placeholder = 'Write a reply...';
    const controls = document.createElement('div');
    controls.className = 'comments-controls';
    const error = document.createElement('span');
    error.className = 'comments-error';
    const cancel = makeButton('Cancel', 'comments-small-button', () => {
      replyingTo = null;
      render();
    });
    const submit = makeButton('Reply', 'comments-small-button', null, 'submit');
    controls.append(error, cancel, submit);
    replyForm.append(field, controls);
    replyForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const body = field.value.trim();
      if (!body) return;
      submit.disabled = true;
      const { data, error: insertError } = await db.from('comments')
        .insert({ page: pageKey, body, parent_id: comment.id }).select('id').single();
      submit.disabled = false;
      if (insertError) {
        error.textContent = insertError.message;
        return;
      }
      replyingTo = null;
      await load(data.id);
    });
    card.append(replyForm);
    field.focus();
  }

  function render() {
    const pages = paginate();
    currentPage = Math.min(Math.max(1, currentPage), Math.max(1, pages.length));
    const page = pages[currentPage - 1] || [];
    const byId = new Map(comments.map((comment) => [comment.id, comment]));
    list.replaceChildren();

    page.forEach(({ comment, depth }) => {
      const card = document.createElement('article');
      card.className = 'comments-card';
      if (depth) {
        card.style.marginLeft = `${depth * 1.25}rem`;
        card.style.borderLeft = '3px solid #5865f2';
      }
      card.append(avatar(comment.avatar_url, comment.author_name));
      const content = document.createElement('div');
      content.className = 'comments-content';
      const header = document.createElement('div');
      header.className = 'comments-header';
      const author = document.createElement('strong');
      author.textContent = comment.author_name;
      const time = document.createElement('span');
      time.className = 'comments-time';
      time.textContent = timeAgo(comment.created_at);
      header.append(author, time);
      const parent = comment.parent_id && byId.get(comment.parent_id);
      if (parent) {
        const replyTo = document.createElement('span');
        replyTo.className = 'comments-reply-to';
        replyTo.textContent = `↳ replying to ${parent.author_name}`;
        header.append(replyTo);
      }
      if (user?.id === comment.user_id) {
        const remove = makeButton('Delete', 'comments-small-button comments-delete', async () => {
          const hasReplies = comments.some((item) => item.parent_id === comment.id);
          const prompt = hasReplies ? 'Delete this comment and all its replies?' : 'Delete this comment?';
          if (!confirm(prompt)) return;
          const { error } = await db.from('comments').delete().eq('id', comment.id);
          if (error) window.alert(error.message);
          else await load();
        });
        header.append(remove);
      }
      const message = document.createElement('p');
      message.className = 'comments-message';
      message.textContent = comment.body;
      content.append(header, message);
      const actions = document.createElement('div');
      actions.className = 'comments-actions';
      if (user && depth < MAX_DEPTH && replyingTo !== comment.id) {
        actions.append(makeButton('Reply', 'comments-small-button', () => {
          replyingTo = replyingTo === comment.id ? null : comment.id;
          render();
        }));
      }
      content.append(actions);
      if (replyingTo === comment.id && user && depth < MAX_DEPTH) addReplyForm(content, comment);
      card.append(content);
      list.append(card);
    });

    status.hidden = comments.length > 0;
    if (!comments.length) status.textContent = 'No comments yet. Be the first!';
    const total = pages.length || 1;
    pageTotal.textContent = String(total);
    pageInput.max = String(total);
    pageInput.value = String(currentPage);
    pager.hidden = pages.length <= 1;
    for (const id of ['first', 'prev']) $(`${id}-btn`).disabled = currentPage <= 1;
    for (const id of ['next', 'last']) $(`${id}-btn`).disabled = currentPage >= total;
    wrapCommentsText();
  }

  async function load(focusId) {
    const { data, error } = await db.from('comments').select('*').eq('page', pageKey)
      .order('created_at', { ascending: false }).limit(1000);
    if (error) {
      console.error(error);
      status.hidden = false;
      status.textContent = `Couldn't load comments: ${error.message}`;
      wrapCommentsText();
      return;
    }
    comments = data || [];
    if (focusId) {
      const pageIndex = paginate().findIndex((items) => items.some((item) => item.comment.id === focusId));
      if (pageIndex >= 0) currentPage = pageIndex + 1;
    }
    render();
  }

  function renderAuth() {
    userInfo.replaceChildren();
    if (user) {
      const name = displayName(user);
      const details = document.createElement('div');
      const userName = document.createElement('strong');
      userName.textContent = name;
      const loginText = document.createElement('small');
      loginText.textContent = 'Logged in with Discord';
      details.append(userName, loginText);
      userInfo.append(avatar(user.user_metadata?.avatar_url, name), details);
      authButton.textContent = 'Log out';
      form.hidden = false;
    } else {
      const details = document.createElement('div');
      const prompt = document.createElement('strong');
      prompt.textContent = 'Not logged in';
      const loginText = document.createElement('small');
      loginText.textContent = 'Log in to join the conversation';
      details.append(prompt, loginText);
      userInfo.append(avatar('', '?'), details);
      authButton.textContent = 'Login with Discord';
      form.hidden = true;
      replyingTo = null;
    }
    wrapCommentsText();
    render();
  }

  authButton.addEventListener('click', async () => {
    if (user) await db.auth.signOut();
    else await db.auth.signInWithOAuth({
      provider: 'discord',
      options: { redirectTo: location.origin + location.pathname + location.search },
    });
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const body = text.value.trim();
    if (!body) return;
    formError.textContent = '';
    postButton.disabled = true;
    const { data, error } = await db.from('comments').insert({ page: pageKey, body }).select('id').single();
    postButton.disabled = false;
    if (error) {
      formError.textContent = error.message;
      return;
    }
    text.value = '';
    await load(data.id);
  });

  $('first-btn').addEventListener('click', () => goToPage(1));
  $('prev-btn').addEventListener('click', () => goToPage(currentPage - 1));
  $('next-btn').addEventListener('click', () => goToPage(currentPage + 1));
  $('last-btn').addEventListener('click', () => goToPage(Number.MAX_SAFE_INTEGER));
  pageInput.addEventListener('change', () => goToPage(pageInput.value));
  pageInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      goToPage(pageInput.value);
      pageInput.blur();
    }
  });

  function goToPage(page) {
    currentPage = Math.floor(Number(page)) || 1;
    replyingTo = null;
    render();
  }

  db.auth.onAuthStateChange((_event, session) => {
    user = session?.user || null;
    renderAuth();
  });
  db.channel('main-page-comments-feed')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, () => load())
    .subscribe();

  load();
})();
