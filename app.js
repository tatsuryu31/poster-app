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
            const defaultStatus = cols[5] ? cols[5].trim() : '未';
            const currentStatus = savedStatus[id] || defaultStatus;
            const currentNote = savedNotes[id] || '';

            locationData[id] = {
                id: id,
                voteDistrict: cols[1].trim(),
                posterNum: cols[2].trim(),
                address: cols[3] ? cols[3].trim() : '',
                name: cols[4] ? cols[4].trim() : '',
                status: currentStatus,
                note: currentNote,
                coords: [parseFloat(cols[6]), parseFloat(cols[7])]
            };
        }
    }
}

function renderUI() {
    const tableBody = document.getElementById('table-body');
    const locationList = document.getElementById('location-list');
    
    if (tableBody) tableBody.innerHTML = '';
    if (locationList) locationList.innerHTML = '';

    let doneCount = 0;
    let totalCount = 0;

    Object.values(locationData).forEach(data => {
        totalCount++;
        if (data.status === '済') doneCount++;

        // マップピン描画
        if (!markers[data.id] && !isNaN(data.coords[0])) {
            const marker = L.marker(data.coords).addTo(map);
            markers[data.id] = marker;
        }
        
        if (markers[data.id]) {
            updateMarkerPopup(markers[data.id], data.id, data.status);
        }

        // 簡易リスト用（マップ下部）
        if (locationList) {
            const item = document.createElement('div');
            item.style.cssText = 'padding:8px; border-bottom:1px solid #eee; display:flex; justify-content:space-between; align-items:center;';
            item.innerHTML = `
                <div>
                    <b>[${data.voteDistrict}] No.${data.posterNum} ${data.name}</b><br>
                    <small style="color:#666;">${data.address}</small>
                    <div style="margin-top:4px;">
                        <input type="text" value="${data.note}" placeholder="現場メモ..." onchange="saveNote('${data.id}', this.value)" style="width:100%; padding:2px 4px; font-size:12px;">
                    </div>
                </div>
                <div style="text-align:right; min-width:70px;">
                    <span class="status-badge ${data.status === '済' ? 'status-done' : 'status-un'}">${data.status}</span><br>
                    <button class="btn btn-secondary" onclick="toggleStatus('${data.id}')" style="margin-top:4px; padding:2px 6px;">切替</button>
                </div>
            `;
            locationList.appendChild(item);
        }

        // フルテーブル用（一覧タブ）
        if (tableBody) {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><input type="checkbox" value="${data.id}"></td>
                <td>${data.posterNum}</td>
                <td>${data.voteDistrict}</td>
                <td>${data.name}</td>
                <td>${data.address}</td>
                <td><span class="status-badge ${data.status === '済' ? 'status-done' : 'status-un'}">${data.status}</span></td>
                <td>
                    <button class="btn btn-secondary" onclick="toggleStatus('${data.id}')">切替</button>
                </td>
            `;
            tableBody.appendChild(tr);
        }
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
    
    // 誤操作防止策（確認ダイアログ）
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

function switchView(view) {
    const mapTab = document.getElementById('tab-map');
    const listTab = document.getElementById('tab-list');
    const listContainer = document.getElementById('list-container');
    const fullListContainer = document.getElementById('full-list-container');
    const mapElem = document.getElementById('map');

    if (view === 'map') {
        mapTab.classList.add('active');
        listTab.classList.remove('active');
        mapElem.style.display = 'block';
        listContainer.style.display = 'block';
        fullListContainer.style.display = 'none';
        if (map) map.invalidateSize();
    } else {
        listTab.classList.add('active');
        mapTab.classList.remove('active');
        mapElem.style.display = 'none';
        listContainer.style.display = 'none';
        fullListContainer.style.display = 'block';
    }
}