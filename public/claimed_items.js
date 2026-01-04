const claimedList = document.getElementById('claimedList');
const appealModal = document.getElementById('appealModal');
const ticketModal = document.getElementById('ticketModal');

let selectedClaim = null;
let STUDENTS = {};

/* 1. LOAD STUDENT CSV FOR VALIDATION */
fetch('/students.csv')
    .then(res => res.text())
    .then(text => {
        text.split(/\r?\n/).slice(1).forEach(row => {
            const parts = row.split(',');
            if (parts.length >= 3) {
                const sn = parts[0].trim();
                const last = parts[1].trim();
                const first = parts[2].trim();
                STUDENTS[sn] = `${first} ${last}`;
            }
        });
    });

/* 2. AUTO-VALIDATE STUDENT NUMBER IN MODAL */
document.getElementById('appealStudent').oninput = (e) => {
    const sn = e.target.value.trim();
    const nameField = document.getElementById('appealName');
    if (STUDENTS[sn]) {
        nameField.value = STUDENTS[sn];
        nameField.style.borderColor = "var(--red)";
    } else {
        nameField.value = "Student Not Found";
        nameField.style.borderColor = "rgba(255,255,255,0.1)";
    }
};

/* 3. LOAD CLAIMED ITEMS */
fetch('/api/claimed-items')
    .then(res => res.json())
    .then(items => {
        if (!items || items.length === 0) {
            claimedList.innerHTML = `<div class="item" style="justify-content: center;"><p>NO ITEMS HAVE BEEN CLAIMED YET.</p></div>`;
            return;
        }

        claimedList.innerHTML = '';
        items.forEach(item => {
            const div = document.createElement('div');
            div.className = 'item';
            const photoSrc = item.photo ? item.photo : '';

            div.innerHTML = `
                <img src="${photoSrc}" alt="Item photo" onerror="this.src='images/no-image.png'">
                <div class="item-content">
                    <h3>${item.name.toUpperCase()}</h3>
                    <small>
                        <b>CATEGORY:</b> ${item.category}<br>
                        <b>LOCATION:</b> ${item.location}<br>
                        <b>CLAIMED BY:</b> ${item.claimerName} (${item.claimerStudent})
                    </small>
                    <button class="appeal-trigger">APPEAL OWNERSHIP</button>
                </div>
            `;

            div.querySelector('.appeal-trigger').onclick = () => {
                selectedClaim = item;
                appealModal.style.display = 'flex';
            };
            claimedList.appendChild(div);
        });
    });

/* 4. SUBMIT APPEAL & SHOW RECEIPT */
document.getElementById('submitAppeal').onclick = () => {
    const sn = document.getElementById('appealStudent').value.trim();
    const reason = document.getElementById('appealReason').value.trim();

    if (!STUDENTS[sn]) {
        alert('Please enter a valid Student Number from the records.');
        return;
    }
    if (!reason) {
        alert('Please provide a reason for the appeal.');
        return;
    }

    // Populate Receipt
    document.getElementById('r_ticketId').textContent = "APP-" + Date.now();
    document.getElementById('r_itemName').textContent = selectedClaim.name;
    document.getElementById('r_appellant').textContent = STUDENTS[sn] + ` (${sn})`;
    document.getElementById('r_date').textContent = new Date().toLocaleString();

    appealModal.style.display = 'none';
    ticketModal.style.display = 'flex';
};

function closeModals() {
    appealModal.style.display = 'none';
}

function closeTicket() {
    ticketModal.style.display = 'none';
    window.location.reload();
}

window.onclick = (event) => {
    if (event.target == appealModal) appealModal.style.display = "none";
};