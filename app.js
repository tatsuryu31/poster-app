// Firebase 初期化設定
const firebaseConfig = {
  apiKey: "AIzaSyCDdyYbnzbqS6PWDTwakQWbzR22fU1xu_I",
  authDomain: "poster-app-3e0ba.firebaseapp.com",
  databaseURL: "https://poster-app-3e0ba-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "poster-app-3e0ba",
  storageBucket: "poster-app-3e0ba.firebasestorage.app",
  messagingSenderId: "386817493362",
  appId: "1:386817493362:web:8a193d700d8971b37d35eb"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

let locationData = {};
let map;
let markers = {};
let selectedDistricts = new Set();

document.addEventListener('DOMContentLoaded', () => {
    initMap();
    loadCSV();
});

function initMap() {
    map = L.map('map').setView([36.233, 139.525], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);
}

function loadCSV() {
    fetch('locations.csv')
        .then(response => response.text())
        .then(data => {
            parseCSV(data);
            generateDistrictCheckboxes();
            listenToFirebase();
        })
        .catch(err => {
            console.error('CSV読み込みエラー:', err);
            const summaryElem = document.getElementById('summary-count');
            if (summaryElem) summaryElem.innerText = 'データ読み込み失敗';
        });
}

function parseCSV(csvText) {
    const lines = csvText.trim().split('\n');

    for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',');
        if (cols.length >= 8) {
            const id = cols[0].trim();
            locationData[id] = {
                id: id,
                voteDistrict: cols[1].trim(),
                posterNum: cols[2].trim(),
                address: cols[3].trim(),
                name: cols[4].trim(),
                status: cols[5].trim(), // "未" または "済" / "完了" など
                note: '',
                coords: [parseFloat(cols[6]), parseFloat(cols[7])]
            };
        }
    }
}

// 投票区チェックボックスの動的生成
function generateDistrictCheckboxes() {
    const container = document.getElementById('district-checkboxes');
    if (!container) return;

    const districts = Array.from(new Set(Object.values(locationData).map(d => d.voteDistrict)))
        .sort((a, b) => {
            const numA = parseInt(a.match(/\d+/)?.[0] || 0);
            const numB = parseInt(b.match(/\d+/)?.[0] || 0);
            return numA - numB;
        });

    selectedDistricts = new Set(districts); // 初期状態は全選択

    let html = `<label style="font-weight:bold; margin-right:5px;"><input type="checkbox" id="toggle-all-districts" checked onchange="toggleAllDistricts(this.checked)"> 全選択/解除</label> | `;
    
    districts.forEach(d => {
        html += `<label><input type="checkbox" class="district-filter" value="${d}" checked onchange="onDistrictChange()"> ${d}</label> `;
    });

    container.innerHTML = html;
}

function toggleAllDistricts(checked) {
    const checkboxes = document.querySelectorAll('.district-filter');
    selectedDistricts.clear();
    checkboxes.forEach(cb => {
        cb.checked = checked;
        if (checked) selectedDistricts.add(cb.value);
    });
    applyFilters();
}

function onDistrictChange() {
    const checkboxes = document.querySelectorAll('.district-filter');
    selectedDistricts.clear();
    let allChecked = true;
    checkboxes.forEach(cb => {
        if (cb.checked) {
            selectedDistricts.add(cb.value);
        } else {
            allChecked = false;
        }
    });
    const toggleAll = document.getElementById('toggle-all-districts');
    if (toggleAll) toggleAll.checked = allChecked;
    applyFilters();
}

function listenToFirebase() {
    db.ref('posters').on('value', (snapshot) => {
        const remoteData = snapshot.val() || {};
        
        Object.keys(locationData).forEach(id => {
            if (remoteData[id]) {
                if (remoteData[id].status !== undefined) {
                    locationData[id].status = remoteData[id].status;
                }
                if (remoteData[id].note !== undefined) {
                    locationData[id].note = remoteData[id].note;
                }
            }
        });

        applyFilters();
    });
}

function applyFilters() {
    const searchVal = document.getElementById('search-box')?.value.toLowerCase().trim() || '';
    const statusVal = document.getElementById('status-filter')?.value || 'all';

    const filteredData = Object.values(locationData).filter(item => {
        // 1. 検索ワード判定
        const matchesSearch = !searchVal || 
            item.posterNum.toString().includes(searchVal) ||
            item.name.toLowerCase().includes(searchVal) ||
            item.address.toLowerCase().includes(searchVal) ||
            item.voteDistrict.toLowerCase().includes(searchVal);

        // 2. ステータス判定 ("済"/"完了" と "未")
        const isDone = (item.status === '済' || item.status === '完了' || item.status === '掲示済');
        let matchesStatus = true;
        if (statusVal === 'un') matchesStatus = !isDone;
        if (statusVal === 'done') matchesStatus = isDone;

        // 3. 投票区判定
        const matchesDistrict = selectedDistricts.has(item.voteDistrict);

        return matchesSearch && matchesStatus && matchesDistrict;
    });

    renderUI(filteredData);
}

function renderUI(filteredList) {
    const tableBody = document.getElementById('table-body');
    const locationList = document.getElementById('location-list');
    
    if (tableBody) tableBody.innerHTML = '';
    if (locationList) locationList.innerHTML = '';

    // 非表示になったマーカーを非表示、該当するものを表示
    const filteredIds = new Set(filteredList.map(item => item.id));

    let doneCount = 0;
    let totalCount = filteredList.length;

    // マーカーの更新と表示制御
    Object.values(locationData).forEach(data => {
        const dNum = data.voteDistrict.match(/\d+/) ? data.voteDistrict.match(/\d+/)[0] : '';
        const label = `${dNum}-${data.posterNum}`;
        const isDone = (data.status === '済' || data.status === '完了' || data.status === '掲示済');

        const customIcon = L.divIcon({
            className: `custom-icon ${isDone ? 'pin-done' : 'pin-un'}`,
            html: label,
            iconSize: [38, 20],
            iconAnchor: [19, 10]
        });

        if (!markers[data.id] && !isNaN(data.coords[0])) {
            const marker = L.marker(data.coords, { icon: customIcon }).addTo(map);
            markers[data.id] = marker;
        } else if (markers[data.id]) {
            markers[data.id].setIcon(customIcon);
        }

        if (markers[data.id]) {
            updateMarkerPopup(markers[data.id], data.id, data.status);

            // フィルター結果に含まれていればマップ表示、なければ非表示
            if (filteredIds.has(data.id)) {
                map.addLayer(markers[data.id]);
            } else {
                map.removeLayer(markers[data.id]);
            }
        }
    });

    // リスト描画
    filteredList.forEach(data => {
        const isDone = (data.status === '済' || data.status === '完了' || data.status === '掲示済');
        if (isDone) doneCount++;

        const navUrl = `https://www.google.com/maps/dir/?api=1&destination=${data.coords[0]},${data.coords[1]}`;

        // マップ下の簡易リスト
        if (locationList) {
            const item = document.createElement('div');
            item.style.cssText = 'padding:10px; border-bottom:1px solid #eee; display:flex; justify-content:space-between; align-items:center;';
            item.innerHTML = `
                <div style="display:flex; align-items:flex-start; gap:8px; flex:1; margin-right:8px;">
                    <input type="checkbox" class="nav-checkbox" value="${data.id}" style="margin-top:4px;">
                    <div style="flex:1;">
                        <b>[${data.voteDistrict}] No.${data.posterNum} ${data.name}</b><br>
                        <small style="color:#666;">${data.address}</small>
                        <div style="margin-top:4px;">
                            <input type="text" value="${data.note}" placeholder="現場メモ..." onchange="saveNote('${data.id}', this.value)" style="width:100%; padding:3px 4px; font-size:12px; border:1px solid #ccc; border-radius:3px;">
                        </div>
                    </div>
                </div>
                <div style="text-align:right; display:flex; flex-direction:column; gap:4px; align-items:flex-end;">
                    <span class="status-badge ${isDone ? 'status-done' : 'status-un'}">${data.status}</span>
                    <div style="display:flex; gap:4px; margin-top:2px;">
                        <button class="btn btn-secondary" onclick="toggleStatus('${data.id}')" style="padding:2px 6px; font-size:11px;">切替</button>
                        <a href="${navUrl}" target="_blank" class="btn-nav" style="padding:2px 6px; font-size:11px;">ナビ</a>
                    </div>
                </div>
            `;
            locationList.appendChild(item);
        }

        // フルテーブル（一覧リスト専用タブ）
        if (tableBody) {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><input type="checkbox" class="nav-checkbox" value="${data.id}"></td>
                <td>${data.posterNum}</td>
                <td>${data.voteDistrict}</td>
                <td>${data.name}</td>
                <td>${data.address}</td>
                <td><span class="status-badge ${isDone ? 'status-done' : 'status-un'}">${data.status}</span></td>
                <td>
                    <button class="btn btn-secondary" onclick="toggleStatus('${data.id}')" style="margin-bottom:2px;">切替</button>
                    <a href="${navUrl}" target="_blank" class="btn-nav" style="padding:2px 6px; font-size:11px;">ナビ</a>
                </td>
                <td>
                    <input type="text" value="${data.note}" placeholder="メモ..." onchange="saveNote('${data.id}', this.value)" style="width:100%; min-width:110px; padding:3px; font-size:12px; border:1px solid #ccc; border-radius:3px;">
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
    const isDone = (status === '済' || status === '完了' || status === '掲示済');
    const navUrl = `https://www.google.com/maps/dir/?api=1&destination=${data.coords[0]},${data.coords[1]}`;
    const content = `
        <div style="font-size:14px; min-width:180px;">
            <b>[${data.voteDistrict}] No.${data.posterNum} ${data.name}</b><br>
            <small>${data.address}</small><br>
            <div style="margin-top:8px;">
                <button onclick="toggleStatus('${id}')" style="padding:4px 8px;">${isDone ? '未に戻す' : '完了にする'}</button>
                <a href="${navUrl}" target="_blank" class="btn-nav" style="margin-left:5px;">ナビ</a>
            </div>
            <div style="margin-top:6px;">
                <input type="text" value="${data.note}" placeholder="現場メモ..." onchange="saveNote('${id}', this.value)" style="width:90%; padding:3px 4px; font-size:12px;">
            </div>
        </div>
    `;
    marker.bindPopup(content);
}

function toggleStatus(id) {
    const data = locationData[id];
    const isDone = (data.status === '済' || data.status === '完了' || data.status === '掲示済');
    const nextStatus = isDone ? '未' : '済';
    
    if (confirm(`[${data.name}] のステータスを「${nextStatus}」に変更しますか？`)) {
        db.ref(`posters/${id}/status`).set(nextStatus);
    }
}

function saveNote(id, text) {
    db.ref(`posters/${id}/note`).set(text);
}

function startBatchNavigation() {
    const checkboxes = document.querySelectorAll('.nav-checkbox:checked');
    if (checkboxes.length === 0) {
        alert('ナビ巡回したい地点のチェックボックスを選択してください。');
        return;
    }

    const selectedCoords = Array.from(checkboxes).map(cb => {
        const id = cb.value;
        return locationData[id].coords.join(',');
    });

    const destination = selectedCoords.pop();
    const waypoints = selectedCoords.join('|');
    
    let url = `https://www.google.com/maps/dir/?api=1&destination=${destination}`;
    if (waypoints.length > 0) {
        url += `&waypoints=${waypoints}`;
    }
    window.open(url, '_blank');
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