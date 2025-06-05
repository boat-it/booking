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

    ws.send(JSON.stringify({ type: "book", room, start: start.toISOString(), end: end.toISOString(), note, booker }));

    document.getElementById("room").value = "ห้องประชุม 1";
    document.getElementById("note").value = "";
    document.getElementById("booker").value = "";
    const today = new Date().toISOString().split("T")[0];
    document.getElementById("startDate").value = today;
    populateTimeDropdowns();
    adjustEndTime();
}

function adjustEndTime() {
    const start = document.getElementById("startTime").value;
    const endSel = document.getElementById("endTime");
    const options = Array.from(endSel.options);
    for (let opt of options) {
        opt.disabled = opt.value <= start;
    }
    if (endSel.value <= start) {
        const next = options.find((o) => o.value > start && !o.disabled);
        if (next) endSel.value = next.value;
    }
}

function populateTimeDropdowns() {
    const startSel = document.getElementById("startTime");
    const endSel = document.getElementById("endTime");
    const options = [];
    for (let h = 8; h <= 17; h++) {
        for (let m of [0, 30]) {
            const hour = h.toString().padStart(2, "0");
            const min = m.toString().padStart(2, "0");
            options.push(`${hour}:${min}`);
        }
    }
    startSel.innerHTML = endSel.innerHTML = options.map(time => `<option value="${time}">${time}</option>`).join("");
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

ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === "init") {
        bookings = data.bookings;
        renderCalendar(true);
    } else if (data.type === "booked") {
        bookings.push(data.booking);
        renderCalendar();
        Swal.fire({ toast: true, icon: "success", title: "จองสำเร็จ", position: "top-end", showConfirmButton: false, timer: 2000 });
    } else if (data.type === "cancelled") {
        bookings = bookings.filter((b) => b.id !== data.id);
        renderCalendar();
        Swal.fire({ toast: true, icon: "info", title: "ยกเลิกสำเร็จ", position: "top-end", showConfirmButton: false, timer: 2000 });
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
    adjustEndTime();
});

Object.assign(window, { book, cancelBooking, adjustEndTime, openModal, closeModal });