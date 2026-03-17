let groups = JSON.parse(localStorage.getItem('todoGroups')) || [];
let currentGroupId = null;
let dragSourceIndex = null;

const container = document.getElementById('todoContainer');
const modal = document.getElementById('modal');
const groupInput = document.getElementById('groupInput');
const mainFooter = document.getElementById('mainFooter');
const customAlert = document.getElementById('customAlert');
const alertMessage = document.querySelector('#customAlert p');

function sync() {
    localStorage.setItem('todoGroups', JSON.stringify(groups));
    render();
}

function openGroupModal() {
    groupInput.value = "";
    modal.classList.remove('hidden');
    groupInput.focus();
}

function closeModal() { modal.classList.add('hidden'); }

function saveGroup() {
    const val = groupInput.value.trim();
    if (val) {
        groups.push({ id: Date.now(), name: val, items: [] });
        closeModal();
        sync();
    }
}

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

function cleanupEmptyItems() {
    if (currentGroupId !== null) {
        const group = groups.find(g => g.id === currentGroupId);
        const originalLength = group.items.length;
        group.items = group.items.filter(item => item.text.trim() !== "" || item.completed);
        if (group.items.length !== originalLength) {
            sync();
        }
    }
}

function backToMain() {
    cleanupEmptyItems();
    currentGroupId = null;
    document.getElementById('mainHeader').classList.remove('hidden');
    document.getElementById('subHeader').classList.add('hidden');
    document.getElementById('backBtn').classList.add('hidden');
    mainFooter.classList.remove('hidden');
    render();
}

function addNewItemRow() {
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

function finishGroup(id, button) {
    const row = button.closest('.item-row-v2');
    row.classList.add('anim-shatter');
    row.style.pointerEvents = 'none';
    setTimeout(() => {
        groups = groups.filter(g => g.id !== id);
        sync();
    }, 800);
}

function handleDragStart(e, index) {
    dragSourceIndex = index;
    e.dataTransfer.setData('text/plain', index);
    e.target.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
}

function handleDragEnter(e) {
    e.preventDefault();
    const row = e.target.closest('.item-row-v2');
    if (row) {
        row.classList.add('drag-over');
    }
}

function handleDragLeave(e) {
    const row = e.target.closest('.item-row-v2');
    if (row) {
        row.classList.remove('drag-over');
    }
}

function handleDrop(e, targetIndex) {
    e.preventDefault();
    const row = e.target.closest('.item-row-v2');
    if (row) {
        row.classList.remove('drag-over');
    }
    
    document.querySelectorAll('.item-row-v2').forEach(el => {
        el.classList.remove('dragging');
    });
    
    if (dragSourceIndex === null || dragSourceIndex === targetIndex) {
        dragSourceIndex = null;
        return;
    }
    
    if (currentGroupId === null) {
        const [movedGroup] = groups.splice(dragSourceIndex, 1);
        groups.splice(targetIndex, 0, movedGroup);
    } else {
        const group = groups.find(g => g.id === currentGroupId);
        const [movedItem] = group.items.splice(dragSourceIndex, 1);
        group.items.splice(targetIndex, 0, movedItem);
    }
    
    dragSourceIndex = null;
    sync();
}

function handleDragEnd(e) {
    e.target.classList.remove('dragging');
    document.querySelectorAll('.item-row-v2').forEach(el => {
        el.classList.remove('drag-over');
    });
    dragSourceIndex = null;
}

function render() {
    container.innerHTML = '';
    if (currentGroupId === null) {
        if (groups.length === 0) {
            container.innerHTML = '<p class="empty-msg">belum ada kegiatan nih</p>';
        } else {
            groups.forEach((group, index) => {
                const div = document.createElement('div');
                div.className = "flex justify-between items-center item-row-v2 hover:bg-slate-50 cursor-pointer px-2 transition-all";
                div.setAttribute('draggable', 'true');
                div.setAttribute('data-index', index);
                div.ondragstart = (e) => handleDragStart(e, index);
                div.ondragenter = handleDragEnter;
                div.ondragleave = handleDragLeave;
                div.ondragover = handleDragOver;
                div.ondrop = (e) => handleDrop(e, index);
                div.ondragend = handleDragEnd;
                div.innerHTML = `
                    <div class="flex-1" onclick="enterGroup(${group.id})">
                        <p class="list-text-main">${index + 1}. ${group.name}</p>
                    </div>
                    <div class="flex items-center gap-4">
                        <button onclick="event.stopPropagation(); finishGroup(${group.id}, this)" class="btn-selesai">SELESAI</button>
                    </div>
                `;
                container.appendChild(div);
            });
        }
    } else {
        const group = groups.find(g => g.id === currentGroupId);
        if (group.items.length === 0) {
            container.innerHTML = '<p class="empty-msg">belum ada kegiatan nih</p>';
        } else {
            group.items.forEach((item, index) => {
                const div = document.createElement('div');
                div.className = "flex items-start item-row-v2 px-2";
                div.setAttribute('draggable', 'true');
                div.setAttribute('data-index', index);
                div.ondragstart = (e) => handleDragStart(e, index);
                div.ondragenter = handleDragEnter;
                div.ondragleave = handleDragLeave;
                div.ondragover = handleDragOver;
                div.ondrop = (e) => handleDrop(e, index);
                div.ondragend = handleDragEnd;
                div.innerHTML = `
                    <div class="drag-handle mr-2 text-slate-400">
                        <i class="fa-solid fa-grip-vertical"></i>
                    </div>
                    <input type="checkbox" class="w-5 h-5 border-2 border-black rounded mt-1 mr-4" ${item.completed ? 'checked' : ''} onchange="toggleCheck(${item.id})">
                    <div class="flex-1">
                        <textarea data-id="${item.id}" 
                            class="item-input ${item.completed ? 'opacity-20 line-through' : ''}" 
                            placeholder="masukkan kegiatan..."
                            oninput="updateText(${item.id}, this)"
                            onkeydown="handleEnter(event)"
                            rows="1">${item.text}</textarea>
                    </div>
                    <button onclick="deleteItem(${item.id})" class="btn-hapus-text ml-2">HAPUS</button>
                `;
                container.appendChild(div);
                const ta = div.querySelector('textarea');
                adjustHeight(ta);
            });
        }
    }
}

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

function toggleCheck(itemId) {
    const group = groups.find(g => g.id === currentGroupId);
    const item = group.items.find(i => i.id === itemId);
    item.completed = !item.completed;
    sync();
}

function updateText(itemId, el) {
    const group = groups.find(g => g.id === currentGroupId);
    const item = group.items.find(i => i.id === itemId);
    item.text = el.value;
    adjustHeight(el);
    localStorage.setItem('todoGroups', JSON.stringify(groups));
}

function deleteGroup(id) {
    alertMessage.innerText = "Kamu serius ingin menghapus kegiatan ini?";
    customAlert.classList.remove('hidden');
    
    document.getElementById('confirmDelete').onclick = () => {
        groups = groups.filter(g => g.id !== id);
        customAlert.classList.add('hidden');
        sync();
    };
    
    document.getElementById('cancelDelete').onclick = () => customAlert.classList.add('hidden');
}

function deleteItem(itemId) {
    alertMessage.innerText = "Kamu serius ingin menghapus kegiatan ini?";
    customAlert.classList.remove('hidden');
    
    document.getElementById('confirmDelete').onclick = () => {
        const group = groups.find(g => g.id === currentGroupId);
        group.items = group.items.filter(i => i.id !== itemId);
        customAlert.classList.add('hidden');
        sync();
    };
    
    document.getElementById('cancelDelete').onclick = () => customAlert.classList.add('hidden');
}

function deleteAllGroups() {
    if (groups.length === 0) return;
    
    alertMessage.innerText = "Kamu Yakin Hapus Semua Kegiatan?";
    customAlert.classList.remove('hidden');
    
    document.getElementById('confirmDelete').onclick = () => {
        const allRows = document.querySelectorAll('.item-row-v2');
        allRows.forEach(row => {
            row.classList.add('anim-shatter');
            row.style.pointerEvents = 'none';
        });
        
        setTimeout(() => {
            groups = [];
            customAlert.classList.add('hidden');
            sync();
        }, 800);
    };
    
    document.getElementById('cancelDelete').onclick = () => customAlert.classList.add('hidden');
}

document.addEventListener('mousedown', (e) => {
    if (!e.target.closest('.item-row-v2') && !e.target.closest('.btn-add-paper-small') && !e.target.closest('.drag-handle')) {
        cleanupEmptyItems();
    }
});

render();