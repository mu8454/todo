(() => {
  'use strict';

  const STORAGE_KEY = 'todo-app.v1';
  const FILTERS = {
    all: () => true,
    active: (t) => !t.done,
    completed: (t) => t.done,
  };

  const $ = (id) => document.getElementById(id);
  const els = {
    form: $('new-todo-form'),
    input: $('new-todo'),
    list: $('todo-list'),
    empty: $('empty'),
    footer: $('footer'),
    count: $('count'),
    toggleAll: $('toggle-all'),
    clearCompleted: $('clear-completed'),
    today: $('today'),
  };

  let todos = load();
  let filter = 'all';

  // ---------- 저장소 ----------
  function load() {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return Array.isArray(data) ? data.filter((t) => t && typeof t.title === 'string') : [];
    } catch {
      return [];
    }
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
    } catch {
      // 저장소를 쓸 수 없는 환경(사생활 보호 모드 등)에서도 앱은 계속 동작
    }
  }

  function commit() {
    save();
    render();
  }

  // ---------- 상태 변경 ----------
  function uid() {
    return (crypto.randomUUID && crypto.randomUUID()) || Date.now().toString(36) + Math.random().toString(36).slice(2);
  }

  function addTodo(title) {
    todos.push({ id: uid(), title, done: false, createdAt: Date.now() });
    commit();
  }

  function updateTodo(id, patch) {
    todos = todos.map((t) => (t.id === id ? { ...t, ...patch } : t));
    commit();
  }

  function removeTodo(id) {
    todos = todos.filter((t) => t.id !== id);
    commit();
  }

  // ---------- 렌더링 ----------
  function renderItem(todo) {
    const li = document.createElement('li');
    li.className = 'todo' + (todo.done ? ' done' : '');
    li.dataset.id = todo.id;

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = todo.done;
    checkbox.className = 'check';
    checkbox.setAttribute('aria-label', `"${todo.title}" 완료`);

    const title = document.createElement('span');
    title.className = 'title';
    title.textContent = todo.title;

    const actions = document.createElement('div');
    actions.className = 'actions';
    actions.append(
      iconButton('edit-btn', '✎', '수정'),
      iconButton('delete', '✕', '삭제'),
    );

    li.append(checkbox, title, actions);
    return li;
  }

  function iconButton(cls, symbol, label) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'icon-btn ' + cls;
    btn.textContent = symbol;
    btn.title = label;
    btn.setAttribute('aria-label', label);
    return btn;
  }

  function render() {
    const visible = todos.filter(FILTERS[filter]);
    const activeCount = todos.filter(FILTERS.active).length;
    const completedCount = todos.length - activeCount;

    els.list.replaceChildren(...visible.map(renderItem));

    els.empty.hidden = visible.length > 0;
    els.empty.textContent = todos.length === 0
      ? '할 일이 없습니다. 위에서 추가해 보세요.'
      : filter === 'active' ? '진행 중인 할 일이 없습니다. 🎉' : '완료한 할 일이 없습니다.';

    els.footer.hidden = todos.length === 0;
    els.count.textContent = `남은 할 일 ${activeCount}개`;
    els.clearCompleted.disabled = completedCount === 0;

    els.toggleAll.disabled = todos.length === 0;
    const allDone = todos.length > 0 && activeCount === 0;
    els.toggleAll.classList.toggle('all-done', allDone);
    els.toggleAll.setAttribute('aria-label', allDone ? '모두 미완료로 표시' : '모두 완료로 표시');

    document.querySelectorAll('.filters a').forEach((a) => {
      a.classList.toggle('selected', a.dataset.filter === filter);
    });
  }

  // ---------- 편집 ----------
  function startEdit(li) {
    const todo = todos.find((t) => t.id === li.dataset.id);
    if (!todo || li.querySelector('.edit')) return;

    const titleEl = li.querySelector('.title');
    const input = document.createElement('input');
    input.className = 'edit';
    input.value = todo.title;
    input.maxLength = 200;
    input.setAttribute('aria-label', '할 일 수정');

    let finished = false;
    const finish = (saveChanges) => {
      if (finished) return;
      finished = true;
      if (!saveChanges) return render();
      const value = input.value.trim();
      if (!value) removeTodo(todo.id);
      else if (value !== todo.title) updateTodo(todo.id, { title: value });
      else render();
    };

    input.addEventListener('keydown', (e) => {
      if (e.isComposing || e.keyCode === 229) return; // 한글 IME 조합 중 Enter 무시 (229: Safari)
      if (e.key === 'Enter') finish(true);
      else if (e.key === 'Escape') finish(false);
    });
    input.addEventListener('blur', () => finish(true));

    titleEl.replaceWith(input);
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  }

  // ---------- 이벤트 ----------
  els.form.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = els.input.value.trim();
    if (!title) return;
    addTodo(title);
    els.input.value = '';
    els.input.focus();
  });

  els.list.addEventListener('change', (e) => {
    if (!e.target.matches('.check')) return;
    const li = e.target.closest('.todo');
    updateTodo(li.dataset.id, { done: e.target.checked });
  });

  els.list.addEventListener('click', (e) => {
    const li = e.target.closest('.todo');
    if (!li) return;
    if (e.target.closest('.delete')) removeTodo(li.dataset.id);
    else if (e.target.closest('.edit-btn')) startEdit(li);
  });

  els.list.addEventListener('dblclick', (e) => {
    if (e.target.matches('.title')) startEdit(e.target.closest('.todo'));
  });

  els.toggleAll.addEventListener('click', () => {
    const done = todos.some((t) => !t.done);
    todos = todos.map((t) => ({ ...t, done }));
    commit();
  });

  els.clearCompleted.addEventListener('click', () => {
    todos = todos.filter(FILTERS.active);
    commit();
  });

  function applyHash() {
    const name = location.hash.replace(/^#\/?/, '');
    filter = Object.hasOwn(FILTERS, name) ? name : 'all';
    render();
  }
  window.addEventListener('hashchange', applyHash);

  // 다른 탭에서 변경된 내용 동기화
  window.addEventListener('storage', (e) => {
    if (e.key !== STORAGE_KEY) return;
    todos = load();
    render();
  });

  els.today.textContent = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
  });

  applyHash();
})();
