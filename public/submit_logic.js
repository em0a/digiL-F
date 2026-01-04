document.addEventListener('DOMContentLoaded', () => {

    const video = document.getElementById('video');
    const photo = document.getElementById('photo');
    const captureBtn = document.getElementById('captureBtn');
    const submitBtn = document.getElementById('submitBtn');

    const studentNumber = document.getElementById('studentNumber');
    const password = document.getElementById('password');
    const itemName = document.getElementById('itemName');
    const category = document.getElementById('category');
    const location = document.getElementById('location');

    const confirmModal = document.getElementById('confirmModal');
    const confirmSubmitBtn = document.getElementById('confirmSubmitBtn');
    const cancelSubmitBtn = document.getElementById('cancelSubmitBtn');

    const receiptModal = document.getElementById('receiptModal');
    const receiptBox = receiptModal.querySelector('div');

    let cameraStream = null;
    let capturedBlob = null;
    let isSubmitting = false;

    /* ===============================
       LOAD STUDENT CSV
    =============================== */
    let VALID_STUDENTS = new Set();
    let studentsLoaded = false;

    fetch('/students.csv')
        .then(res => res.text())
        .then(text => {
            text.split(/\r?\n/).slice(1).forEach(row => {
                const cols = row.split(',');
                if (cols[0]) {
                    VALID_STUDENTS.add(cols[0].trim());
                }
            });
            studentsLoaded = true;
        })
        .catch(() => {
            alert('Student database failed to load');
        });

    /* ===============================
       CAMERA
    =============================== */
    navigator.mediaDevices.getUserMedia({ video: true })
        .then(stream => {
            cameraStream = stream;
            video.srcObject = stream;
            video.play();
        });

    /* ===============================
       CAPTURE PHOTO
    =============================== */
    captureBtn.onclick = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        canvas.width = 640;
        canvas.height = video.videoHeight * (640 / video.videoWidth);

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        canvas.toBlob(blob => {
            capturedBlob = blob;
            photo.src = URL.createObjectURL(blob);
            photo.style.display = 'block';
            video.style.display = 'none';
        }, 'image/jpeg', 0.6);
    };

    /* ===============================
       OPEN CONFIRM (WITH VALIDATION)
    =============================== */
    submitBtn.onclick = () => {

        if (isSubmitting) return;

        if (!studentsLoaded) {
            alert('Student database still loading. Please wait.');
            return;
        }

        if (
            !studentNumber.value.trim() ||
            !password.value ||
            !itemName.value.trim() ||
            !category.value ||
            !location.value
        ) {
            alert('Please complete all fields');
            return;
        }

        if (!VALID_STUDENTS.has(studentNumber.value.trim())) {
            alert('Invalid student number');
            return;
        }

        confirmModal.style.display = 'flex';
    };

    /* ===============================
       CANCEL CONFIRM
    =============================== */
    cancelSubmitBtn.onclick = () => {
        confirmModal.style.display = 'none';
    };

    /* ===============================
       CONFIRM SUBMIT
    =============================== */
    confirmSubmitBtn.onclick = async () => {

        if (isSubmitting) return;
        isSubmitting = true;

        const formData = new FormData();
        formData.append('studentNumber', studentNumber.value.trim());
        formData.append('password', password.value);
        formData.append('itemName', itemName.value.trim());
        formData.append('category', category.value);
        formData.append('location', location.value);

        if (capturedBlob) {
            formData.append('photo', capturedBlob, 'item.jpg');
        }

        const res = await fetch('/api/submit', {
            method: 'POST',
            body: formData
        });

        const item = await res.json();

        /* RECEIPT (FORCE DISPLAY) */
        receiptBox.innerHTML = `
            <h3 style="text-align:center; letter-spacing:3px;">
                SUBMISSION RECEIPT
            </h3>
            <p><b>Item ID:</b> ${item.id}</p>
            <p><b>Item Name:</b> ${item.name}</p>
            <p><b>Category:</b> ${item.category}</p>
            <p><b>Location:</b> ${item.location}</p>
            <p><b>Student Number:</b> ${item.studentNumber}</p>
            <button class="submit-btn" id="goHomeBtn"
                style="margin-top:18px;">
                RETURN TO HOME
            </button>
        `;

        confirmModal.style.display = 'none';
        receiptModal.style.display = 'flex';

        receiptBox.querySelector('#goHomeBtn').onclick = () => {
            window.location.href = 'index.html';
        };
    };

});
