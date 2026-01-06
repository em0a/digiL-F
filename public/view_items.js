if (window.HAS_INITIALIZED_VIEW_ITEMS) {
    throw new Error("Script stopped to prevent double-loading.");
}
window.HAS_INITIALIZED_VIEW_ITEMS = true;

document.addEventListener('DOMContentLoaded', () => {
    const itemsGrid = document.getElementById('itemsGrid');
    const searchInput = document.getElementById('searchInput');
    const filterCategory = document.getElementById('filterCategory');
    const filterLocation = document.getElementById('filterLocation');
    
    const claimModal = document.getElementById('claimModal');
    const editModal = document.getElementById('editModal');
    
    const video = document.getElementById('video');
    const captureBtn = document.getElementById('captureBtn');
    let confirmClaimBtn = document.getElementById('confirmClaim');
    
    const claimerStudent = document.getElementById('claimerStudent');
    const claimerName = document.getElementById('claimerName');
    const receiptSection = document.getElementById('claimReceipt');
    const mainContent = document.getElementById('modalMainContent');
    
    const editValidationStep = document.getElementById('editValidationStep');
    const editFormStep = document.getElementById('editFormStep');
    const newLocationSelect = document.getElementById('new_location');
    
    let ALL_ITEMS = [];
    let STUDENTS = {};
    let selectedItem = null;
    let cameraStream = null;
    let capturedBlob = null;
    let isCameraActive = false;
    let modelsLoaded = false;
    let isClaimInProgress = false;
    let hasClaimSucceeded = false;
    
    async function loadModels() {
        try {
            console.log("Loading AI Models...");
            await faceapi.nets.ssdMobilenetv1.loadFromUri('/models');
            modelsLoaded = true;
            console.log("✓ Models Loaded");
        } catch (error) {
            console.log("Model load skipped or failed (non-critical if files missing).");
        }
    }
    loadModels();

    fetch('/students.csv').then(res => res.text()).then(text => {
        text.split(/\r?\n/).slice(1).forEach(row => {
            const p = row.split(',');
            if (p.length >= 3) STUDENTS[p[0].trim()] = `${p[2].trim()} ${p[1].trim()}`;
        });
    });

    function loadItems() {
        fetch('/api/items')
            .then(res => res.json())
            .then(items => {
                ALL_ITEMS = items;
                renderItems(items);
            })
            .catch(err => console.error("Error loading items:", err));
    }
    loadItems();

    function applyFilters() {
        const s = searchInput.value.toLowerCase();
        const c = filterCategory.value;
        const l = filterLocation.value;
        
        const filtered = ALL_ITEMS.filter(i => 
            i.name.toLowerCase().includes(s) && 
            (!c || i.category === c) && 
            (!l || i.location === l)
        );
        renderItems(filtered);
    }

    searchInput.addEventListener('input', applyFilters);
    filterCategory.addEventListener('change', applyFilters);
    filterLocation.addEventListener('change', applyFilters);

    function renderItems(items) {
        itemsGrid.innerHTML = '';
        items.forEach(item => {
            const rawDate = item.dateSubmitted || item.date || item.created_at || item.timestamp;
            const dateStr = rawDate 
                ? new Date(rawDate).toLocaleDateString() + ' ' + new Date(rawDate).toLocaleTimeString()
                : "Date not available";

            const card = document.createElement('div');
            card.className = 'item-card';
            card.innerHTML = `
                <img src="${item.photo || 'images/no-image.png'}">
                <h4>${item.name}</h4>
                <div class="item-meta">ID: ${item.id}</div>
                <div class="item-meta">${item.category} • ${item.location}</div>
                <div class="item-meta" style="color: #fff; font-weight: bold; margin-top: 8px; border-top: 1px solid rgba(255,255,255,0.2); padding-top: 8px;">
                    Submitted: ${dateStr}
                </div>
                <div class="card-actions">
                    <button class="btn btn-claim" data-id="${item.id}">CLAIM</button>
                    <button class="btn btn-edit" data-id="${item.id}">EDIT</button>
                </div>
            `;
            itemsGrid.appendChild(card);
        });
    }

    itemsGrid.addEventListener('click', (e) => {
        const target = e.target;
        const itemId = target.getAttribute('data-id');
        if (!itemId) return;

        selectedItem = ALL_ITEMS.find(i => i.id == itemId);
        if (!selectedItem) return;

        if (target.classList.contains('btn-claim')) openClaim();
        else if (target.classList.contains('btn-edit')) openEdit();
    });

    function openClaim() {
        isClaimInProgress = false;
        hasClaimSucceeded = false;
        capturedBlob = null;

        claimModal.style.display = 'flex';
        mainContent.style.display = 'flex';
        receiptSection.style.display = 'none';
        claimModal.querySelector('.modal-title').innerText = "CLAIM AUTHENTICATION";

        confirmClaimBtn.innerText = "CONFIRM CLAIM";
        confirmClaimBtn.disabled = false;
        confirmClaimBtn.style.opacity = "1";

        captureBtn.innerText = "STARTING CAMERA...";
        captureBtn.style.background = "#444";
        captureBtn.disabled = true;

        startCamera();
    }

    async function startCamera() {
        if (!modelsLoaded) await loadModels();

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: 'user', width: 640, height: 480 } 
            });

            video.srcObject = stream;
            cameraStream = stream;
            isCameraActive = true;

            video.onloadedmetadata = () => {
                video.play();
                detectFacePresence();
            };

            setTimeout(() => {
                if(captureBtn.disabled && !capturedBlob) {
                    captureBtn.disabled = false;
                    captureBtn.innerText = "MANUAL CAPTURE (AI TIMEOUT)";
                    captureBtn.style.background = "var(--red)";
                }
            }, 5000);

        } catch (err) {
            alert("Camera access denied.");
        }
    }

    async function detectFacePresence() {
        if (!isCameraActive || video.paused || video.ended || capturedBlob) return;

        if (!modelsLoaded) {
            setTimeout(detectFacePresence, 500);
            return;
        }

        try {
            const options = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 });
            const detection = await faceapi.detectSingleFace(video, options);

            if (detection) {
                captureBtn.disabled = false;
                captureBtn.style.background = "var(--red)";
                captureBtn.innerText = "CAPTURE FACE ID";
            } else {
                captureBtn.disabled = true;
                captureBtn.style.background = "#333";
                captureBtn.innerText = "LOOK AT CAMERA";
            }
        } catch (err) { } 

        setTimeout(detectFacePresence, 100);
    }

    captureBtn.onclick = () => {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth; 
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);

        canvas.toBlob(b => { 
            capturedBlob = b; 
            captureBtn.innerText = "FACE ID SECURED ✓";
            captureBtn.style.background = "#2e7d32"; 
            captureBtn.disabled = true;
            video.pause();
        }, 'image/jpeg');
    };

    claimerStudent.addEventListener('input', () => {
        const name = STUDENTS[claimerStudent.value.trim()];
        claimerName.value = name || "Student not found";
    });

    const newBtn = confirmClaimBtn.cloneNode(true);
    confirmClaimBtn.parentNode.replaceChild(newBtn, confirmClaimBtn);
    confirmClaimBtn = newBtn;

    confirmClaimBtn.onclick = async (e) => {
        e.preventDefault();

        const finalStudentNumber = claimerStudent.value;
        const finalName = claimerName.value; 

        if (hasClaimSucceeded) return;
        if (isClaimInProgress) return;

        if(!capturedBlob || !finalName || finalName.includes("not found")) {
            return alert("Capture Face ID and provide valid Student Number.");
        }

        isClaimInProgress = true;

        confirmClaimBtn.innerText = "PROCESSING...";
        confirmClaimBtn.disabled = true;
        confirmClaimBtn.style.opacity = "0.7";

        const fd = new FormData();
        fd.append('claimerStudent', finalStudentNumber);
        fd.append('claimerName', finalName); 
        fd.append('photo', capturedBlob, 'claim.jpg');

        try {
            const res = await fetch(`/api/claim/${selectedItem.id}`, { method: 'POST', body: fd });

            if(res.ok) {
                const data = await res.json();
                hasClaimSucceeded = true; 

                mainContent.style.display = 'none'; 
                claimModal.querySelector('.modal-title').innerText = "CLAIM SUCCESSFUL";
                receiptSection.style.display = 'block';

                document.getElementById('r_claimId').textContent = data.claimId || "N/A";
                document.getElementById('r_itemName').textContent = selectedItem.name;
                document.getElementById('r_location').textContent = selectedItem.location;
                document.getElementById('r_name').textContent = finalName; 
                document.getElementById('r_date').textContent = new Date().toLocaleString();

                if(cameraStream) cameraStream.getTracks().forEach(t => t.stop());
            } else {
                throw new Error("Server rejected claim");
            }
        } catch (err) {
            if (hasClaimSucceeded) return;

            console.error(err);
            alert("Claim failed. Please try again.");

            isClaimInProgress = false;
            confirmClaimBtn.innerText = "CONFIRM CLAIM";
            confirmClaimBtn.disabled = false;
            confirmClaimBtn.style.opacity = "1";
        }
    };

    function openEdit() {
        if(!selectedItem) return;
        document.getElementById('editItemId').value = selectedItem.id;
        editModal.style.display = 'flex';
        editValidationStep.style.display = 'block';
        editFormStep.style.display = 'none';
    }

    window.closeModal = () => location.reload();

    const verifyBtn = document.getElementById('verifyEditBtn');
    if(verifyBtn) {
        verifyBtn.onclick = () => {
            const sID = document.getElementById('editStudentId').value.trim();
            const pass = document.getElementById('editPassword').value.trim();

            if(sID === selectedItem.studentNumber && pass === selectedItem.password) {
                editValidationStep.style.display = 'none';
                editFormStep.style.display = 'block';

                document.getElementById('new_itemName').value = selectedItem.name;
                document.getElementById('new_category').value = selectedItem.category;
                newLocationSelect.value = selectedItem.location;
            } else {
                alert("Incorrect credentials.");
            }
        };
    }

    const saveBtn = document.getElementById('saveEditBtn');
    if(saveBtn) {
        saveBtn.onclick = async () => {
            const updated = {
                name: document.getElementById('new_itemName').value.trim(),
                category: document.getElementById('new_category').value,
                location: newLocationSelect.value,
                studentNumber: selectedItem.studentNumber,
                password: selectedItem.password
            };

            try {
                const res = await fetch(`/api/items/${selectedItem.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(updated)
                });
                if(res.ok) {
                    alert("Update Successful!");
                    window.location.reload();
                } else alert("Update failed.");
            } catch (err) { alert("Server connection error."); }
        };
    }
});
