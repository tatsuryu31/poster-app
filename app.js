let locationData = {};
let map;
let markers = {};
const storageKey = 'posterStatusBackup';
const noteStorageKey = 'posterNotesBackup';

document.addEventListener('DOMContentLoaded', () => {
    initMap();
    loadCSV();
});

function initMap() {
    map = L.map('map').setView([36.245, 139.540], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);
}

function loadCSV() {
    fetch('locations.csv')
        .then(response => response.text())
        .then(data => {
            parseCSV(data);
            renderUI();
        });
}

function parseCSV(csvText) {
    const lines = csvText.trim().split('\n');
    const savedStatus = JSON.parse(localStorage.getItem(storageKey)) || {};
    const savedNotes = JSON.parse(localStorage.getItem(noteStorageKey)) || {};

    for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',');
        if (cols.length >= 5) {
            const id = cols[0].trim();
            const defaultStatus = cols[4].trim();
            const currentStatus = savedStatus[id] || defaultStatus;
            const currentNote = savedNotes[id] || '';

            locationData[id] = {
                id: id,
                voteDistrict: cols[1].trim(),
                posterNum: cols[2].trim(),
                name: cols[3].trim(),
                address: cols[4] ? cols[4].trim() : '',
                status: currentStatus,
                note: currentNote,
                coords: [parseFloat(cols[5]), parseFloat(cols[6])]
            };
        }
    }
}

function renderUI() {
    const tableBody = document.getElementById('poster-table-body');
    if (!tableBody) return;
    tableBody.innerHTML = '';

    let doneCount = 0;
    let totalCount = 0;

    Object.values(locationData).forEach(data => {
        totalCount++;
        if (data.status === '済') doneCount++;

        if (!markers[data.id]) {
            const marker = L.marker(data.coords).addTo(map);
            markers[data.id] = marker;
        }
        
        updateMarkerPopup(markers[data.id], data.id, data.status);

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${data.id}</td>
            <td>[${data.voteDistrict}] ${data.name}</td>
            <td><span class="status-badge ${data.status === '済' ? 'status-done' : 'status-todo'}">${data.status}</span></td>
            <td>
                <button class="btn btn-secondary" onclick="toggleStatus('${data.id}')">切替</button>
            </td>
            <td>
                <input type="text" class="note-input" value="${data.note}" placeholder="メモ..." onchange="saveNote('${data.id}', this.value)">
            </td>
        `;
        tableBody.appendChild(tr);
    });

    const percent = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;
    const summaryElem = document.getElementById('summary-count');
    if (summaryElem) {
        summaryElem.innerText = `表示中:${totalCount}件 (完了:${doneCount} / 進捗:${percent}%)`;
    }
}

function updateMarkerPopup(marker, id, status) {
    const data = locationData[id];
    const navUrl = `https://www.google.com/maps/dir/?api=1&destination=${data.coords[0]},${data.coords[1]}`;
    const content = `
        <div style="font-size:14px;">
            <b>[${data.voteDistrict}] No.${data.posterNum} ${data.name}</b><br>
            <small>${data.address}</small><br>
            <div style="margin-top:8px;">
                <button onclick="toggleStatus('${id}')" style="padding:4px 8px;">${status === '済' ? '未に戻す' : '完了にする'}</button>
                <a href="${navUrl}" target="_blank" class="btn-nav" style="margin-left:5px;">ナビ</a>
            </div>
            <div style="margin-top:6px;">
                <input type="text" value="${data.note}" placeholder="現場メモ..." onchange="saveNote('${id}', this.value)" style="width:90%; padding:2px 4px;">
            </div>
        </div>
    `;
    marker.bindPopup(content);
}

function toggleStatus(id) {
    const data = locationData[id];
    const nextStatus = data.status === '済' ? '未' : '済';
    
    if (confirm(`[${data.name}] のステータスを「${nextStatus}」に変更しますか？`)) {
        data.status = nextStatus;
        const savedStatus = JSON.parse(localStorage.getItem(storageKey)) || {};
        savedStatus[id] = data.status;
        localStorage.setItem(storageKey, JSON.stringify(savedStatus));
        renderUI();
    }
}

function saveNote(id, text) {
    locationData[id].note = text;
    const savedNotes = JSON.parse(localStorage.getItem(noteStorageKey)) || {};
    savedNotes[id] = text;
    localStorage.setItem(noteStorageKey, JSON.stringify(savedNotes));
}