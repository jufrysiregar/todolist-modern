/**
 * TodoList Modern
 * Storage: Capacitor Preferences (dengan fallback localStorage saat di browser)
 * Drag & Drop: SortableJS
 */

// ─── Storage abstraction ─────────────────────────────────────────────────────
// Di Android (Capacitor): pakai @capacitor/preferences (native secure storage)
// Di browser dev: fallback ke localStorage otomatis

const Storage = {
    async get(key) {
        if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Preferences) {
            const { value } = await window.Capacitor.Plugins.Preferences.get({ key });
            return value ? JSON.parse(value) : null;
        }
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : null;
    },
    async set(key, value) {
        if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Preferences) {
            await window.Capacitor.Plugins.Preferences.set({ key, value: JSON.stringify(value) });
        } else {
            localStorage.setItem(key, JSON.stringify(value));
        }
    }
};

// ─── State ───────────────────────────────────────────────────────────────────

let groups         = [];
let currentGroupId = null;
let sortableGroups = null;
let sortableItems  = null;

// ─── DOM refs ────────────────────────────────────────────────────────────────

const container    = document.getElementById('todoContainer');
const modal        = document.getElementById('modal');
const groupInput   = document.getElementById('groupInput');
const mainFooter   = document.getElementById('mainFooter');
const customAlert  = document.getElementById('customAlert');
const alertMessage = document.querySelector('#customAlert p');

// ─── Persistensi ─────────────────────────────────────────────────────────────

async function loadGroups() {
    const saved = await Storage.get('todoGroups');
    groups = saved || [];
    render();
}

async function saveGroups() {
    await Storage.set('todoGroups', groups);
}

async function sync() {
    await saveGroups();
    render();
}

// ─── Modal grup ──────────────────────────────────────────────────────────────

function openGroupModal() {
    groupInput.value = "";
    modal.classList.remove('hidden');
    groupInput.focus();
}

function closeModal() {
    modal.classList.add('hidden');
}

async function saveGroup() {
    const val = groupInput.value.trim();
    if (val) {
        groups.push({ id: Date.now(), name: val, items: [] });
        closeModal();
        await sync();
    }
}

// ─── Navigasi ────────────────────────────────────────────────────────────────

function enterGroup(id) {
    currentGroupId = id;
    document.getElementById('mainHeader').classList.add('hidden');
    document.getElementById('subHeader').classList.remove('hidden');
    document.getElementById('backBtn').classList.remove('hidden');
    mainFooter.classList.add('hidden');
    const group = groups.find(g => g.id === id);
    document.getElementById('currentGroupName').innerText = group.name;
    render();
}

async function cleanupEmptyItems() {
    if (currentGroupId !== null) {
        const group = groups.find(g => g.id === currentGroupId);
        const originalLength = group.items.length;
        group.items = group.items.filter(item => item.text.trim() !== "" || item.completed);
        if (group.items.length !== originalLength) {
            await sync();
        }
    }
}

async function backToMain() {
    await cleanupEmptyItems();
    currentGroupId = null;
    document.getElementById('mainHeader').classList.remove('hidden');
    document.getElementById('subHeader').classList.add('hidden');
    document.getElementById('backBtn').classList.add('hidden');
    mainFooter.classList.remove('hidden');
    render();
}

// ─── Item ─────────────────────────────────────────────────────────────────────

async function addNewItemRow() {
    const group = groups.find(g => g.id === currentGroupId);
    const lastItem = group.items[group.items.length - 1];
    if (lastItem && lastItem.text.trim() === "") {
        const existingInput = container.querySelector(`textarea[data-id="${lastItem.id}"]`);
        if (existingInput) existingInput.focus();
        return;
    }
    const newItem = { id: Date.now(), text: "", completed: false };
    group.items.push(newItem);
    render();
    const lastInput = container.querySelector(`textarea[data-id="${newItem.id}"]`);
    if (lastInput) {
        lastInput.focus();
        adjustHeight(lastInput);
    }
}

async function finishGroup(id, button) {
    const row = button.closest('.item-row-v2');
    row.classList.add('anim-shatter');
    row.style.pointerEvents = 'none';
    setTimeout(async () => {
        groups = groups.filter(g => g.id !== id);
        await sync();
    }, 800);
}

// ─── Render ───────────────────────────────────────────────────────────────────

function render() {
    if (sortableGroups) { sortableGroups.destroy(); sortableGroups = null; }
    if (sortableItems)  { sortableItems.destroy();  sortableItems  = null; }

    container.innerHTML = '';

    if (currentGroupId === null) {
        // Tampilan daftar grup
        if (groups.length === 0) {
            container.innerHTML = '<p class="empty-msg">belum ada kegiatan nih</p>';
            return;
        }

        groups.forEach((group, index) => {
            const div = document.createElement('div');
            div.className = "flex justify-between items-center item-row-v2 hover:bg-slate-50 cursor-pointer px-2 transition-all";
            div.setAttribute('data-id', group.id);
            div.innerHTML = `
                <div class="drag-handle mr-3 text-slate-400 touch-none">
                    <i class="fa-solid fa-grip-vertical"></i>
                </div>
                <div class="flex-1" onclick="enterGroup(${group.id})">
                    <p class="list-text-main">${index + 1}. ${group.name}</p>
                </div>
                <div class="flex items-center gap-4">
                    <button onclick="event.stopPropagation(); finishGroup(${group.id}, this)" class="btn-selesai">SELESAI</button>
                </div>
            `;
            container.appendChild(div);
        });

        sortableGroups = Sortable.create(container, {
            animation: 150,
            handle: '.drag-handle',
            ghostClass: 'sortable-ghost',
            chosenClass: 'sortable-chosen',
            dragClass: 'sortable-drag',
            onEnd: async (evt) => {
                const [moved] = groups.splice(evt.oldIndex, 1);
                groups.splice(evt.newIndex, 0, moved);
                await saveGroups();
                // Update nomor urut tanpa full re-render
                const rows = container.querySelectorAll('.item-row-v2');
                rows.forEach((row, i) => {
                    const p = row.querySelector('.list-text-main');
                    if (p) p.textContent = `${i + 1}. ${groups[i].name}`;
                });
            }
        });

    } else {
        // Tampilan item dalam grup
        const group = groups.find(g => g.id === currentGroupId);

        if (group.items.length === 0) {
            container.innerHTML = '<p class="empty-msg">belum ada kegiatan nih</p>';
            return;
        }

        group.items.forEach((item) => {
            const div = document.createElement('div');
            div.className = "flex items-start item-row-v2 px-2";
            div.setAttribute('data-id', item.id);
            div.innerHTML = `
                <div class="drag-handle mr-2 text-slate-400 touch-none">
                    <i class="fa-solid fa-grip-vertical"></i>
                </div>
                <input type="checkbox" class="w-5 h-5 border-2 border-black rounded mt-1 mr-4 flex-shrink-0"
                    ${item.completed ? 'checked' : ''}
                    onchange="toggleCheck(${item.id})">
                <div class="flex-1">
                    <textarea data-id="${item.id}"
                        class="item-input ${item.completed ? 'opacity-20 line-through' : ''}"
                        placeholder="masukkan kegiatan..."
                        oninput="updateText(${item.id}, this)"
                        onkeydown="handleEnter(event)"
                        rows="1">${item.text}</textarea>
                </div>
                <button onclick="deleteItem(${item.id})" class="btn-hapus-text ml-2 flex-shrink-0">HAPUS</button>
            `;
            container.appendChild(div);
            const ta = div.querySelector('textarea');
            adjustHeight(ta);
        });

        sortableItems = Sortable.create(container, {
            animation: 150,
            handle: '.drag-handle',
            ghostClass: 'sortable-ghost',
            chosenClass: 'sortable-chosen',
            dragClass: 'sortable-drag',
            onEnd: async (evt) => {
                const group = groups.find(g => g.id === currentGroupId);
                const [moved] = group.items.splice(evt.oldIndex, 1);
                group.items.splice(evt.newIndex, 0, moved);
                await saveGroups();
            }
        });
    }
}

// ─── Input helpers ────────────────────────────────────────────────────────────

function handleEnter(e) {
    if (e.key === "Enter") {
        e.preventDefault();
        addNewItemRow();
    }
}

function adjustHeight(el) {
    el.style.height = "auto";
    el.style.height = (el.scrollHeight) + "px";
}

async function toggleCheck(itemId) {
    const group = groups.find(g => g.id === currentGroupId);
    const item  = group.items.find(i => i.id === itemId);
    item.completed = !item.completed;
    await sync();
}

async function updateText(itemId, el) {
    const group = groups.find(g => g.id === currentGroupId);
    const item  = group.items.find(i => i.id === itemId);
    item.text   = el.value;
    adjustHeight(el);
    await saveGroups(); // save tanpa re-render supaya tidak reset cursor textarea
}

// ─── Delete ───────────────────────────────────────────────────────────────────

function deleteGroup(id) {
    alertMessage.innerText = "Kamu serius ingin menghapus kegiatan ini?";
    customAlert.classList.remove('hidden');
    document.getElementById('confirmDelete').onclick = async () => {
        groups = groups.filter(g => g.id !== id);
        customAlert.classList.add('hidden');
        await sync();
    };
    document.getElementById('cancelDelete').onclick = () => customAlert.classList.add('hidden');
}

function deleteItem(itemId) {
    alertMessage.innerText = "Kamu serius ingin menghapus kegiatan ini?";
    customAlert.classList.remove('hidden');
    document.getElementById('confirmDelete').onclick = async () => {
        const group = groups.find(g => g.id === currentGroupId);
        group.items = group.items.filter(i => i.id !== itemId);
        customAlert.classList.add('hidden');
        await sync();
    };
    document.getElementById('cancelDelete').onclick = () => customAlert.classList.add('hidden');
}

function deleteAllGroups() {
    if (groups.length === 0) return;
    alertMessage.innerText = "Kamu Yakin Hapus Semua Kegiatan?";
    customAlert.classList.remove('hidden');
    document.getElementById('confirmDelete').onclick = async () => {
        const allRows = document.querySelectorAll('.item-row-v2');
        allRows.forEach(row => {
            row.classList.add('anim-shatter');
            row.style.pointerEvents = 'none';
        });
        setTimeout(async () => {
            groups = [];
            customAlert.classList.add('hidden');
            await sync();
        }, 800);
    };
    document.getElementById('cancelDelete').onclick = () => customAlert.classList.add('hidden');
}

// ─── Modal backdrop click ─────────────────────────────────────────────────────

modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
});

customAlert.addEventListener('click', (e) => {
    if (e.target === customAlert) customAlert.classList.add('hidden');
});

// ─── Android back button (Capacitor) ─────────────────────────────────────────

document.addEventListener('backbutton', async (e) => {
    e.preventDefault();

    if (!customAlert.classList.contains('hidden')) {
        customAlert.classList.add('hidden');
        return;
    }
    if (!modal.classList.contains('hidden')) {
        closeModal();
        return;
    }
    if (currentGroupId !== null) {
        await backToMain();
        return;
    }
    // Keluar app
    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App) {
        window.Capacitor.Plugins.App.exitApp();
    }
}, false);

// ─── Cleanup saat klik di luar item row ──────────────────────────────────────

document.addEventListener('mousedown', (e) => {
    if (!e.target.closest('.item-row-v2') &&
        !e.target.closest('.btn-add-paper-small') &&
        !e.target.closest('.drag-handle')) {
        cleanupEmptyItems();
    }
});

// ─── Boot ─────────────────────────────────────────────────────────────────────

loadGroups();
