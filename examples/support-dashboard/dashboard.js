// A frozen support queue keeps the example usable offline and the captures reproducible.
const accounts = [
  { name: 'Northwind Logistics', priority: 'High', reason: 'Two failed renewals are blocking dispatch.', owner: 'Dana Wu', activity: '2 hours ago', escalations: 4, response: 12 },
  { name: 'Meridian Health', priority: 'High', reason: 'A patient intake sync missed its service window.', owner: 'Eli Park', activity: '3 hours ago', escalations: 3, response: 8 },
  { name: 'Alder Studio', priority: 'Elevated', reason: 'An export issue is holding up a client handoff.', owner: 'Ana Reed', activity: '4 hours ago', escalations: 2, response: 4 },
  { name: 'Harbor Works', priority: 'Elevated', reason: 'The warehouse team is waiting on a permissions fix.', owner: 'Jo Bell', activity: '5 hours ago', escalations: 1, response: 6 },
];

const byId = id => document.getElementById(id);
const body = document.querySelector('tbody');
const details = document.querySelector('dialog');
let state = new URLSearchParams(location.search).get('state') || 'success';
let sort = 'priority';
let ascending = false;
let detailTrigger;

function element(tag, text, className) {
  const node = document.createElement(tag);
  node.textContent = text;
  if (className) node.className = className;
  return node;
}

function openAccount(account, trigger) {
  detailTrigger = trigger;
  byId('detail-title').textContent = account.name;
  byId('detail-reason').textContent = account.reason;
  const fields = byId('detail-fields');
  fields.replaceChildren();
  for (const [label, value] of [['Priority', account.priority], ['Owner', account.owner], ['Last activity', account.activity], ['Open escalations', account.escalations]]) {
    const field = document.createElement('div');
    field.append(element('dt', label), element('dd', value));
    fields.append(field);
  }
  details.showModal();
}

function comparePriority(left, right) {
  const rank = { High: 2, Elevated: 1 };
  return rank[left.priority] - rank[right.priority] || left.escalations - right.escalations;
}

function renderRows(rows) {
  const sorted = [...rows].sort((left, right) => {
    const comparison = sort === 'account' ? left.name.localeCompare(right.name) : comparePriority(left, right);
    return ascending ? comparison : -comparison;
  });
  byId('sort-summary').textContent = sort === 'account'
    ? (ascending ? 'Account · A–Z' : 'Account · Z–A')
    : (ascending ? 'Lowest risk first' : 'Highest risk first');
  for (const button of document.querySelectorAll('[data-sort]')) {
    const header = button.closest('th');
    if (button.dataset.sort === sort) header.setAttribute('aria-sort', ascending ? 'ascending' : 'descending');
    else header.removeAttribute('aria-sort');
  }
  body.replaceChildren();
  for (const account of sorted) {
    const row = body.insertRow();
    const name = row.insertCell();
    const open = element('button', account.name, 'account-button');
    open.addEventListener('click', () => openAccount(account, open));
    name.append(open, element('span', account.reason, 'row-note'));
    row.insertCell().append(element('span', account.priority, 'priority ' + account.priority.toLowerCase()));
    for (const value of [account.owner, account.activity]) {
      const cell = row.insertCell();
      cell.className = 'secondary';
      cell.textContent = value;
    }
  }
}

function render() {
  const pending = state === 'loading';
  const rows = pending || state === 'empty' ? [] : accounts;
  const lead = rows.reduce((top, item) => !top || comparePriority(item, top) > 0 ? item : top, null);
  byId('priority-name').textContent = lead?.name || (pending ? 'Loading queue…' : 'Queue clear');
  byId('priority-reason').textContent = lead?.reason || (pending ? 'Retrieving the account snapshot.' : 'All accounts are within their service window.');
  byId('open-list').disabled = !lead;
  byId('account-count').textContent = pending ? '—' : rows.length;
  byId('escalation-count').textContent = pending ? '—' : rows.reduce((total, item) => total + item.escalations, 0);
  const hours = rows.map(item => item.response).sort((a, b) => a - b);
  const middle = Math.floor(hours.length / 2);
  byId('median-response').textContent = hours.length
    ? ((hours[middle] + hours[Math.floor((hours.length - 1) / 2)]) / 2) + ' h' : '—';
  byId('recovery').hidden = state !== 'error';
  byId('queue-status').textContent = pending ? 'Loading accounts…' : (state === 'empty' ? 'No accounts at risk in this snapshot.' : '');
  renderRows(rows);
}

for (const button of document.querySelectorAll('[data-sort]')) {
  button.addEventListener('click', () => {
    const next = button.dataset.sort;
    ascending = next === sort ? !ascending : next === 'account';
    sort = next;
    render();
  });
}
byId('open-list').addEventListener('click', () => body.querySelector('button')?.focus());
body.addEventListener('keydown', event => {
  if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return;
  const buttons = [...body.querySelectorAll('.account-button')];
  const index = buttons.indexOf(event.target);
  if (index < 0) return;
  event.preventDefault();
  const next = index + (event.key === 'ArrowDown' ? 1 : -1);
  buttons[Math.max(0, Math.min(next, buttons.length - 1))].focus();
});
details.addEventListener('close', () => detailTrigger?.focus());
byId('retry').addEventListener('click', () => {
  state = 'success';
  render();
  byId('open-list').focus();
});

function syncNavigation() {
  const active = location.hash === '#accounts' ? '#accounts' : '#main';
  for (const link of document.querySelectorAll('nav a')) {
    if (link.hash === active) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  }
}
for (const link of document.querySelectorAll('.mobile-nav a')) {
  link.addEventListener('click', () => { document.querySelector('.mobile-nav').open = false; });
}
window.addEventListener('hashchange', syncNavigation);
syncNavigation();
render();
