document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const itemsGrid = document.getElementById('itemsGrid');
    const searchInput = document.getElementById('searchInput');
    const filterCategory = document.getElementById('filterCategory');
    const filterLocation = document.getElementById('filterLocation');

    // Modals
    const claimModal = document.getElementById('claimModal');
    const editModal = document.getElementById('editModal');
    
    // Claim Elements
    const video = document.getElementById('video');
    const captureBtn = document.getElementById('captureBtn');
    const confirmClaimBtn = document.getElementById('confirmClaim');
    const claimerStudent = document.getElementById('claimerStudent');
    const claimerName = document.getElementById('claimerName');

    // Edit Elements
    const editValidationStep = document.getElementById('editValidationStep');
    const editFormStep = document.getElementById('editFormStep');
    const newLocationSelect = document.getElementById('new_location');

    let ALL_ITEMS = [];
    let STUDENTS = {};
    let selectedItem = null;
    let cameraStream = null;
    let capturedBlob = null;

    /* 1. LOAD DATA */
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

    /* 2. FILTERING */
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

    /* 3. RENDER */
    function renderItems(items) {
        itemsGrid.innerHTML = '';
        items.forEach(item => {
            const card = document.createElement('div');
            card.className = 'item-card';
            card.innerHTML = `
                <img src="${item.photo || 'images/no-image.png'}">
                <h4>${item.name}</h4>
                <div class="item-meta">ID: ${item.id}</div>
                <div class="item-meta">${item.category} • ${item.location}</div>
                <div class="card-actions">
                    <button class="claim-btn" data-id="${item.id}">CLAIM</button>
                    <button class="edit-trigger-btn" data-id="${item.id}">EDIT</button>
                </div>
            `;
            itemsGrid.appendChild(card);
        });
    }

    /* 4. EVENT DELEGATION (Prevents Auto-fill & Focus Issues) */
    itemsGrid.addEventListener('click', (e) => {
        const target = e.target;
        const itemId = target.getAttribute('data-id');
        
        if (!itemId) return;

        // Prevent browser focus stealing and auto-fill triggers
        e.preventDefault();
        e.stopPropagation();
        if (document.activeElement) document.activeElement.blur();

        selectedItem = ALL_ITEMS.find(i => i.id == itemId);
        if (!selectedItem) return;

        if (target.classList.contains('claim-btn')) {
            openClaim();
        } else if (target.classList.contains('edit-trigger-btn')) {
            openEdit();
        }
    });

    /* 5. MODAL LOGIC */
    function openClaim() {
        claimModal.style.display = 'flex';
        navigator.mediaDevices.getUserMedia({ video: true })
            .then(s => {
                cameraStream = s; 
                video.srcObject = s;
            })
            .catch(err => alert("Camera access required for claims."));
    }

    function openEdit() {
        document.getElementById('editItemId').value = selectedItem.id;
        editModal.style.display = 'flex';
        editValidationStep.style.display = 'block';
        editFormStep.style.display = 'none';
    }

    // Photo Capture
    captureBtn.onclick = () => {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth; 
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);
        canvas.toBlob(b => { 
            capturedBlob = b; 
            captureBtn.textContent = "PHOTO CAPTURED ✓";
            captureBtn.style.background = "#2e7d32";
        }, 'image/jpeg');
    };

    // Auto-fill student name in Claim Modal
    claimerStudent.addEventListener('input', () => {
        const name = STUDENTS[claimerStudent.value.trim()];
        claimerName.value = name || "Student not found";
    });

    // Process Claim
    confirmClaimBtn.onclick = async () => {
        if(!capturedBlob || !claimerName.value || claimerName.value.includes("not found")) {
            return alert("Please capture a photo and provide a valid Student Number.");
        }
        
        const fd = new FormData();
        fd.append('claimerStudent', claimerStudent.value);
        fd.append('claimerName', claimerName.value);
        fd.append('photo', capturedBlob, 'claim.jpg');

        try {
            const res = await fetch(`/api/claim/${selectedItem.id}`, { method: 'POST', body: fd });
            if(res.ok) {
                const data = await res.json();
                document.getElementById('modalMainContent').style.display = 'none';
                document.getElementById('claimReceipt').style.display = 'block';
                document.getElementById('r_claimId').textContent = data.claimId;
                document.getElementById('r_itemName').textContent = selectedItem.name;
                document.getElementById('r_name').textContent = claimerName.value;
                if(cameraStream) cameraStream.getTracks().forEach(t => t.stop());
            }
        } catch (err) { alert("Claim failed. Please try again."); }
    };

    /* 6. EDIT VERIFICATION & UPDATE */
    document.getElementById('verifyEditBtn').onclick = () => {
        const sID = document.getElementById('editStudentId').value.trim();
        const pass = document.getElementById('editPassword').value.trim();

        if(sID === selectedItem.studentNumber && pass === selectedItem.password) {
            editValidationStep.style.display = 'none';
            editFormStep.style.display = 'block';
            
            // Pre-fill Edit Form
            document.getElementById('new_itemName').value = selectedItem.name;
            document.getElementById('new_category').value = selectedItem.category;
            newLocationSelect.value = selectedItem.location;
        } else {
            alert("Verification Failed: Incorrect credentials.");
        }
    };

    document.getElementById('saveEditBtn').onclick = async () => {
        const updated = {
            name: document.getElementById('new_itemName').value.trim(),
            category: document.getElementById('new_category').value,
            location: newLocationSelect.value,
            studentNumber: selectedItem.studentNumber,
            password: selectedItem.password
        };

        if (!updated.name || !updated.location) {
            return alert("Please fill in all fields.");
        }

        try {
            const res = await fetch(`/api/items/${selectedItem.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updated)
            });

            if(res.ok) {
                alert("Update Successful!");
                window.location.reload();
            } else {
                alert("Update failed on server.");
            }
        } catch (err) { alert("Error connecting to server."); }
    };
});