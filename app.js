const storageKey = 'poster-management-status';
const baseCoords = [36.254783, 139.5239229]; // 拠点：大街道会館
let map;
let startCoords = null;
let markers = {};
let locationData = {};

document.addEventListener('DOMContentLoaded', () => {
  initMap();
  loadData();
});

function initMap() {
  map = L.map('map').setView(baseCoords, 14);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
  }).addTo(map);

  L.marker(baseCoords).addTo(map).bindPopup('<b>拠点：大街道会館</b>');
}

async function loadData() {
  try {
    const response = await fetch('locations.csv?v=' + Date.now());
    const text = await response.text();
    const rows = text.trim().split(/\r?\n/).slice(1);

    const savedStatus = JSON.parse(localStorage.getItem(storageKey)) || {};
    const listContainer = document.getElementById('location-list');
    const tableBody = document.getElementById('table-body');
    const districtContainer = document.getElementById('district-checkboxes');

    listContainer.innerHTML = '';
    tableBody.innerHTML = '';
    districtContainer.innerHTML = '';

    const districts = new Set();
    const bounds = [baseCoords];

    rows.forEach(row => {
      if (!row.trim()) return;
      const [id, voteDistrict, posterNum, address, locationName, csvStatus, lat, lng] = row.split(',').map(s => s.trim());
      const status = savedStatus[id] || csvStatus;
      const coords = [parseFloat(lat), parseFloat(lng)];

      districts.add(voteDistrict);
      bounds.push(coords);

      locationData[id] = { id, voteDistrict, posterNum, address, locationName, status, coords };

      addMarker(id, coords, address, locationName, status, voteDistrict, posterNum);
    });

    Array.from(districts).sort().forEach(d => {
      const label = document.createElement('label');
      label.innerHTML = `<input type="checkbox" value="${d}" checked onchange="applyFilters()"> ${d}`;
      districtContainer.appendChild(label);
    });

    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [30, 30] });
    }

    renderUI();
  } catch (e) {
    console.error(e);
  }
}

function addMarker(id, coords, address, locationName, status, voteDistrict, posterNum) {
  const dNum = voteDistrict.match(/\d+/) ? voteDistrict.match(/\d+/)[0] : voteDistrict;
  const label = `${dNum}-${posterNum}`;

  const icon = L.divIcon({
    className: `custom-icon ${status === '済' ? 'pin-done' : 'pin-un'}`,
    html: label,
    iconSize: [38, 20],
    iconAnchor: [19, 10]
  });

  const marker = L.marker(coords, { icon }).addTo(map);
  updateMarkerPopup(marker, id, status);
  markers[id] = marker;
}

function updateMarkerPopup(marker, id, status) {
  const data = locationData[id];
  const btnText = status === '済' ? '未に戻す' : '完了にする';

  const content = `
    <b>[${data.voteDistrict}] No.${data.posterNum} ${data.locationName}</b><br>
    <small>${data.address}</small><br>
    <div style="margin-top:8px; display:flex; gap:5px; flex-wrap:wrap;">
      <button class="btn btn-secondary" onclick="toggleStatus('${id}')">${btnText}</button>
      <button class="btn btn-primary" onclick="setStartPoint('${id}')">始点に設定</button>
      <a class="btn-nav" href="https://www.google.com/maps/dir/?api=1&destination=${data.coords[0]},${data.coords[1]}" target="_blank">ナビ</a>
    </div>
  `;
  marker.bindPopup(content);
}

function toggleStatus(id) {
  const data = locationData[id];
  data.status = data.status === '済' ? '未' : '済';

  const savedStatus = JSON.parse(localStorage.getItem(storageKey)) || {};
  savedStatus[id] = data.status;
  localStorage.setItem(storageKey, JSON.stringify(savedStatus));

  const dNum = data.voteDistrict.match(/\d+/) ? data.voteDistrict.match(/\d+/)[0] : data.voteDistrict;
  const label = `${dNum}-${data.posterNum}`;
  const newIcon = L.divIcon({
    className: `custom-icon ${data.status === '済' ? 'pin-done' : 'pin-un'}`,
    html: label,
    iconSize: [38, 20],
    iconAnchor: [19, 10]
  });
  markers[id].setIcon(newIcon);
  updateMarkerPopup(markers[id], id, data.status);

  renderUI();
}

function renderUI() {
  const searchText = document.getElementById('search-box').value.toLowerCase();
  const statusFilter = document.getElementById('status-filter').value;
  const checkedDistricts = Array.from(document.querySelectorAll('#district-checkboxes input:checked')).map(cb => cb.value);

  const listContainer = document.getElementById('location-list');
  const tableBody = document.getElementById('table-body');
  listContainer.innerHTML = '';
  tableBody.innerHTML = '';

  let totalCount = 0;
  let doneCount = 0;

  Object.values(locationData).forEach(data => {
    const matchSearch = data.id.includes(searchText) || data.locationName.toLowerCase().includes(searchText) || data.address.toLowerCase().includes(searchText);
    const matchStatus = statusFilter === 'all' || (statusFilter === 'done' && data.status === '済') || (statusFilter === 'un' && data.status === '未');
    const matchDistrict = checkedDistricts.includes(data.voteDistrict);

    if (matchSearch && matchStatus && matchDistrict) {
      totalCount++;
      if (data.status === '済') doneCount++;

      markers[data.id].addTo(map);

      // リストカード作成
      const card = document.createElement('div');
      card.style.cssText = 'border-bottom:1px solid #eee; padding:8px 0; display:flex; justify-content:space-between; align-items:center;';
      card.innerHTML = `
        <div>
          <input type="checkbox" class="nav-chk" value="${data.id}">
          <b>[${data.voteDistrict}] No.${data.posterNum} ${data.locationName}</b>
          <span class="status-badge ${data.status === '済' ? 'status-done' : 'status-un'}">${data.status}</span><br>
          <small style="color:#666;">${data.address}</small>
        </div>
        <div style="display:flex; gap:4px;">
          <button class="btn btn-secondary" onclick="toggleStatus('${data.id}')">切替</button>
          <button class="btn btn-primary" onclick="setStartPoint('${data.id}')">始点</button>
          <a class="btn-nav" href="https://www.google.com/maps/dir/?api=1&destination=${data.coords[0]},${data.coords[1]}" target="_blank">ナビ</a>
        </div>
      `;
      listContainer.appendChild(card);

      // テーブル行作成
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><input type="checkbox" class="nav-chk" value="${data.id}"></td>
        <td>${data.posterNum}</td>
        <td>${data.voteDistrict}</td>
        <td>${data.locationName}</td>
        <td>${data.address}</td>
        <td><span class="status-badge ${data.status === '済' ? 'status-done' : 'status-un'}">${data.status}</span></td>
        <td><button class="btn btn-secondary" onclick="toggleStatus('${data.id}')">切替</button></td>
      `;
      tableBody.appendChild(tr);
    } else {
      if (map.hasLayer(markers[data.id])) {
        map.removeLayer(markers[data.id]);
      }
    }
  });

  const percent = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;
  document.getElementById('summary-count').innerText = `表示中: ${totalCount}件 (完了: ${doneCount} / 進捗: ${percent}%)`;
}

function applyFilters() {
  renderUI();
}

function switchView(view) {
  const mapTab = document.getElementById('tab-map');
  const listTab = document.getElementById('tab-list');
  const mapArea = document.getElementById('map');
  const cardList = document.getElementById('list-container');
  const fullList = document.getElementById('full-list-container');

  if (view === 'map') {
    mapTab.classList.add('active');
    listTab.classList.remove('active');
    mapArea.style.display = 'block';
    cardList.style.display = 'block';
    fullList.style.display = 'none';
    map.invalidateSize();
  } else {
    listTab.classList.add('active');
    mapTab.classList.remove('active');
    mapArea.style.display = 'none';
    cardList.style.display = 'none';
    fullList.style.display = 'block';
  }
}

function setStartPoint(id) {
  startCoords = locationData[id].coords;
  alert(`【${locationData[id].locationName}】を巡回ナビのスタート地点に設定しました。`);
}

function startBatchNavigation() {
  const selectedIds = Array.from(document.querySelectorAll('.nav-chk:checked')).map(cb => cb.value);
  if (selectedIds.length === 0) {
    alert('巡回するポスターにチェックを入れてください。');
    return;
  }

  const origin = startCoords ? `${startCoords[0]},${startCoords[1]}` : `${baseCoords[0]},${baseCoords[1]}`;
  const destId = selectedIds.pop();
  const destination = `${locationData[destId].coords[0]},${locationData[destId].coords[1]}`;

  const waypoints = selectedIds.map(id => `${locationData[id].coords[0]},${locationData[id].coords[1]}`).join('|');

  let url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}`;
  if (waypoints) {
    url += `&waypoints=${waypoints}`;
  }

  window.open(url, '_blank');
}