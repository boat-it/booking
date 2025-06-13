const wsProtocol = location.protocol === 'https:' ? 'wss://' : 'ws://';
const ws = new WebSocket(`${wsProtocol}${location.host}/meeting-ws/`);
let calendar;
let bookings = [];
let selectedBookingId = null;

function book() {
    const room = document.getElementById("room").value;
    const date = document.getElementById("startDate").value;
    const timeStart = document.getElementById("startTime").value;
    const timeEnd = document.getElementById("endTime").value;
    const note = document.getElementById("note").value;
    const booker = document.getElementById("booker").value;

    if (!date || !timeStart || !timeEnd || !booker.trim()) {
        Swal.fire({ icon: "warning", text: "กรุณากรอกข้อมูลให้ครบ" });
        return;
    }
    if (timeEnd <= timeStart) {
        Swal.fire({ icon: "warning", text: "เวลาสิ้นสุดต้องมากกว่าเวลาเริ่ม" });
        return;
    }

    const start = new Date(`${date}T${timeStart}`);
    const end = new Date(`${date}T${timeEnd}`);
    if (start.toDateString() !== end.toDateString()) {
        Swal.fire({ icon: "warning", text: "ไม่สามารถจองข้ามวันได้" });
        return;
    }

    // Check for overlapping bookings
    const hasOverlap = bookings.some(booking => {
        const bookingStart = new Date(booking.start);
        const bookingEnd = new Date(booking.end);
        return booking.room === room &&
            ((start >= bookingStart && start < bookingEnd) ||
                (end > bookingStart && end <= bookingEnd) ||
                (start <= bookingStart && end >= bookingEnd));
    });

    if (hasOverlap) {
        Swal.fire({ icon: "error", text: "ช่วงเวลานี้มีการจองแล้ว กรุณาเลือกช่วงเวลาอื่น" });
        return;
    }

    // ส่งข้อมูลไปยัง server ผ่าน WebSocket
    ws.send(JSON.stringify({ type: "book", room, start: start.toISOString(), end: end.toISOString(), note, booker }));

    // --- รีเซ็ตค่าฟอร์มหลังจองเสร็จ ---
    document.getElementById("room").value = "ห้องประชุม 1";
    document.getElementById("note").value = "";
    document.getElementById("booker").value = "";
    const today = new Date().toISOString().split("T")[0];
    document.getElementById("startDate").value = today;

    // โหลดเวลาใหม่ทั้งหมด
    populateTimeDropdowns();
    disableOverlappingTimes();

    // ตั้งค่าเวลาที่ว่างเป็นค่า default
    const startSel = document.getElementById("startTime");
    const endSel = document.getElementById("endTime");
    const nextAvailableStart = Array.from(startSel.options).find(o => !o.disabled);

    if (nextAvailableStart) {
        startSel.value = nextAvailableStart.value;
        const nextAvailableEnd = Array.from(endSel.options).find(
            o => !o.disabled && o.value > nextAvailableStart.value
        );
        endSel.value = nextAvailableEnd ? nextAvailableEnd.value : "";
    } else {
        startSel.value = "";
        endSel.value = "";
        Swal.fire({ icon: "info", text: "ไม่มีช่วงเวลาให้จองในวันนี้แล้ว" });
    }

    adjustEndTime();
}


function adjustEndTime() {
    const startTime = document.getElementById("startTime").value;
    const endSel = document.getElementById("endTime");
    const startDate = document.getElementById("startDate").value;
    const room = document.getElementById("room").value;

    const startDateTime = new Date(`${startDate}T${startTime}`);
    const endOptions = Array.from(endSel.options);

    // เปิดทั้งหมดก่อน
    endOptions.forEach(opt => opt.disabled = false);

    // ดักเวลาที่อยู่ก่อน start หรือเกิน 17:00
    endOptions.forEach(opt => {
        if (opt.value <= startTime || opt.value > "17:00") {
            opt.disabled = true;
        }
    });

    // ดักเวลาสิ้นสุดที่ชนกับ bookings
    const dayBookings = bookings.filter(b => b.room === room && b.start.startsWith(startDate));
    for (let opt of endOptions) {
        const testEndTime = new Date(`${startDate}T${opt.value}`);
        for (let b of dayBookings) {
            const bStart = new Date(b.start);
            const bEnd = new Date(b.end);
            if ((startDateTime < bEnd && testEndTime > bStart)) {
                opt.disabled = true;
                break;
            }
        }
    }

    // แก้ค่า end ถ้า invalid
    if (endSel.value <= startTime || endSel.options.namedItem(endSel.value)?.disabled) {
        const next = endOptions.find(o => !o.disabled && o.value > startTime);
        endSel.value = next ? next.value : "";
    }
}



function populateTimeDropdowns() {
    const startSel = document.getElementById("startTime");
    const endSel = document.getElementById("endTime");

    const startOptions = [];
    const endOptions = [];

    // start: 08:00 ถึง 16:30 เท่านั้น
    for (let h = 8; h <= 16; h++) {
        for (let m of [0, 30]) {
            // ถ้าเกิน 16:30 ไม่ต้องเพิ่ม
            if (h === 16 && m > 30) continue;

            const hour = h.toString().padStart(2, "0");
            const min = m.toString().padStart(2, "0");
            const time = `${hour}:${min}`;
            startOptions.push(`<option value="${time}">${time}</option>`);
        }
    }

    // end: 08:30 ถึง 17:00
    for (let h = 8; h <= 17; h++) {
        for (let m of [0, 30]) {
            if (h === 17 && m > 0) continue; // ไม่เกิน 17:00
            const hour = h.toString().padStart(2, "0");
            const min = m.toString().padStart(2, "0");
            const time = `${hour}:${min}`;
            endOptions.push(`<option value="${time}">${time}</option>`);
        }
    }

    startSel.innerHTML = startOptions.join("");
    endSel.innerHTML = endOptions.join("");
}




function openModal(event) {
    selectedBookingId = parseInt(event.id);
    const note = event.extendedProps.note || "-";
    const booker = event.extendedProps.booker || "-";
    const room = event.extendedProps.room || "-";
    const start = new Date(event.start).toLocaleString();
    const end = new Date(event.end).toLocaleString();

    document.getElementById("modalDetails").innerHTML = `
    <p>🧍‍♂ <strong>ผู้จอง:</strong> ${booker}</p>
    <p>🏢 <strong>ห้อง:</strong> ${room}</p>
    <p>🕒 <strong>เวลา:</strong> ${start} - ${end}</p>
    <p>📝 <strong>หมายเหตุ:</strong> ${note}</p>
  `;

    const modal = document.getElementById("eventModal");
    const box = document.getElementById("modalBox");
    modal.classList.remove("hidden");
    setTimeout(() => {
        box.classList.remove("scale-95", "opacity-0", "translate-y-4");
        box.classList.add("scale-100", "opacity-100", "translate-y-0");
    }, 10);
}

function closeModal() {
    const modal = document.getElementById("eventModal");
    const box = document.getElementById("modalBox");
    box.classList.remove("scale-100", "opacity-100", "translate-y-0");
    box.classList.add("scale-95", "opacity-0", "translate-y-4");
    setTimeout(() => modal.classList.add("hidden"), 200);
}

function cancelBooking() {
    if (selectedBookingId) {
        ws.send(JSON.stringify({ type: "cancel", id: selectedBookingId }));
    }
    closeModal();
}

function disableOverlappingTimes() {
    const room = document.getElementById("room").value;
    const date = document.getElementById("startDate").value;
    const startSel = document.getElementById("startTime");
    const endSel = document.getElementById("endTime");
    const optionsStart = Array.from(startSel.options);
    const optionsEnd = Array.from(endSel.options);

    optionsStart.forEach(opt => opt.disabled = false);
    optionsEnd.forEach(opt => opt.disabled = false);

    const dayBookings = bookings.filter(b => {
        return b.room === room && b.start.startsWith(date);
    });

    for (let booking of dayBookings) {
        const bookingStart = new Date(booking.start);
        const bookingEnd = new Date(booking.end);

        const startStr = bookingStart.toTimeString().slice(0, 5);
        const endStr = bookingEnd.toTimeString().slice(0, 5);

        // Disable options ที่ overlap
        optionsStart.forEach(opt => {
            if (opt.value >= startStr && opt.value < endStr) {
                opt.disabled = true;
            }
        });
        optionsEnd.forEach(opt => {
            if (opt.value > startStr && opt.value <= endStr) {
                opt.disabled = true;
            }
        });
    }

    adjustEndTime(); // เช็คให้ endTime ยังถูกต้อง
}


ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === "init") {
        bookings = data.bookings;
        renderCalendar(true);
    } else if (data.type === "booked") {
        // bookings.push(data.booking);
        // renderCalendar();
        // Swal.fire({ toast: true, icon: "success", title: "จองสำเร็จ", position: "top-end", showConfirmButton: false, timer: 2000 });
        bookings.push(data.booking);
        renderCalendar();

        // รีโหลดเวลาใหม่ และ disable เวลาที่จองไปแล้ว
        populateTimeDropdowns();
        disableOverlappingTimes();

        // เลือก default เวลาว่างหลัง booking ใหม่
        const startSel = document.getElementById("startTime");
        const endSel = document.getElementById("endTime");
        const nextAvailableStart = Array.from(startSel.options).find(o => !o.disabled);

        if (nextAvailableStart) {
            startSel.value = nextAvailableStart.value;
            const nextAvailableEnd = Array.from(endSel.options).find(
                o => !o.disabled && o.value > nextAvailableStart.value
            );
            endSel.value = nextAvailableEnd ? nextAvailableEnd.value : "";
        } else {
            startSel.value = "";
            endSel.value = "";
            Swal.fire({ icon: "info", text: "ไม่มีช่วงเวลาให้จองในวันนี้แล้ว" });
        }

        adjustEndTime();

        Swal.fire({
            toast: true,
            icon: "success",
            title: "จองสำเร็จ",
            position: "top-end",
            showConfirmButton: false,
            timer: 2000
        });
    } else if (data.type === "cancelled") {
        bookings = bookings.filter((b) => b.id !== data.id);
        renderCalendar();

        // รีโหลด dropdown ใหม่ + disable เวลาซ้ำ
        populateTimeDropdowns();
        disableOverlappingTimes();

        // เซ็ตเวลาว่างใหม่เป็น default
        const startSel = document.getElementById("startTime");
        const endSel = document.getElementById("endTime");
        const nextAvailableStart = Array.from(startSel.options).find(o => !o.disabled);

        if (nextAvailableStart) {
            startSel.value = nextAvailableStart.value;
            const nextAvailableEnd = Array.from(endSel.options).find(
                o => !o.disabled && o.value > nextAvailableStart.value
            );
            endSel.value = nextAvailableEnd ? nextAvailableEnd.value : "";
        } else {
            startSel.value = "";
            endSel.value = "";
            Swal.fire({ icon: "info", text: "ไม่มีช่วงเวลาให้จองในวันนี้แล้ว" });
        }

        adjustEndTime();

        Swal.fire({
            toast: true,
            icon: "info",
            title: "ยกเลิกสำเร็จ",
            position: "top-end",
            showConfirmButton: false,
            timer: 2000
        });
    } else if (data.type === "error") {
        Swal.fire({ toast: true, icon: "error", title: data.message, position: "top-end", showConfirmButton: false, timer: 2500 });
    }
};

function renderCalendar(forceClear = false) {
    const events = bookings.map((b) => ({
        id: b.id,
        title: `คุณ ${b.booker || "ไม่ระบุ"}`,
        start: b.start,
        end: b.end,
        color: roomColor(b.room),
        extendedProps: { note: b.note, booker: b.booker, room: b.room }
    }));

    if (calendar && forceClear) {
        calendar.getEventSources().forEach((src) => src.remove());
    }

    if (calendar) {
        calendar.removeAllEvents();
        calendar.addEventSource(events);
        return;
    }

    calendar = new FullCalendar.Calendar(document.getElementById("calendar"), {
        initialView: "timeGridWeek",
        headerToolbar: {
            left: "prev,next today",
            center: "title",
            right: "timeGridDay,timeGridWeek"
        },
        slotMinTime: "08:00:00",
        slotMaxTime: "17:00:00",
        allDaySlot: false,
        locale: "th",
        height: "auto",
        events,
        eventClick: function (info) {
            openModal(info.event);
        }
    });

    calendar.render();
}

function roomColor(roomName) {
    switch (roomName) {
        case "ห้องประชุม 1": return "#f44336";
        case "ห้องประชุม 2": return "#2196f3";
        case "ห้องประชุม 3": return "#ff9800";
        case "ห้องประชุม 4": return "#4caf50";
        case "ห้องประชุม 5": return "#9c27b0";
        case "ห้องประชุม 6": return "#00bcd4";
        case "ห้องประชุม 7": return "#ffc107";
        default: return "#607d8b";
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const today = new Date().toISOString().split("T")[0];
    document.getElementById("startDate").value = today;
    document.getElementById("startDate").min = today;
    populateTimeDropdowns();
    disableOverlappingTimes();
    // adjustEndTime();
});

document.getElementById("startDate").addEventListener("change", () => {
    populateTimeDropdowns();
    disableOverlappingTimes();

    const startSel = document.getElementById("startTime");
    const endSel = document.getElementById("endTime");
    const nextAvailableStart = Array.from(startSel.options).find(o => !o.disabled);

    if (nextAvailableStart) {
        startSel.value = nextAvailableStart.value;
        const nextAvailableEnd = Array.from(endSel.options).find(
            o => !o.disabled && o.value > nextAvailableStart.value
        );
        endSel.value = nextAvailableEnd ? nextAvailableEnd.value : "";
    } else {
        startSel.value = "";
        endSel.value = "";
        Swal.fire({ icon: "info", text: "ไม่มีช่วงเวลาให้จองในวันนี้สำหรับห้องนี้แล้ว" });
    }

    adjustEndTime();
});


document.getElementById("room").addEventListener("change", () => {
    populateTimeDropdowns();
    disableOverlappingTimes();

    // เซ็ตเวลา default ใหม่
    const startSel = document.getElementById("startTime");
    const endSel = document.getElementById("endTime");
    const nextAvailableStart = Array.from(startSel.options).find(o => !o.disabled);

    if (nextAvailableStart) {
        startSel.value = nextAvailableStart.value;
        const nextAvailableEnd = Array.from(endSel.options).find(
            o => !o.disabled && o.value > nextAvailableStart.value
        );
        endSel.value = nextAvailableEnd ? nextAvailableEnd.value : "";
    } else {
        startSel.value = "";
        endSel.value = "";
        Swal.fire({ icon: "info", text: "ไม่มีช่วงเวลาให้จองในวันนี้สำหรับห้องนี้แล้ว" });
    }

    adjustEndTime();
});

Object.assign(window, { book, cancelBooking, adjustEndTime, openModal, closeModal, disableOverlappingTimes });