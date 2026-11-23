const DB = {
    users: "campusbook_users",
    resources: "campusbook_resources",
    bookings: "campusbook_bookings",
    session: "campusbook_session"
};

let currentUser = null, currentRole = "student", authMode = "login", toastTimer, slideIdx = 0, slideTimer;

const $ = id => document.getElementById(id);
const getData = (k, fb = []) => { try { return JSON.parse(localStorage.getItem(k)) ?? fb; } catch { return fb; } };
const saveData = (k, d) => localStorage.setItem(k, JSON.stringify(d));
const makeId = p => p + Date.now().toString().slice(-7) + Math.floor(Math.random() * 90 + 10);
const escapeHTML = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[c]);
const localDateString = () => new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD in local time

function showToast(msg) {
    const t = $("toast");
    if (!t) return alert(msg);
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 3000);
}

function initializeDatabase() {
    const users = getData(DB.users);
    if (!users.some(u => u.role === "admin"))
        users.push({ id: "ADMIN001", name: "Administrator", email: "admin", password: "admin@123", role: "admin" });
    if (!users.some(u => u.email === "student@campus.edu"))
        users.push({ id: "STU001", name: "Demo Student", email: "student@campus.edu", password: "student123", studentId: "STU001", role: "student" });
    saveData(DB.users, users);

    const seedResources = [
        ["RES001", "Computer Science Lab", "Laboratory", "Block A - Room 101", 40, "Computer laboratory with high-performance computers and internet access."],
        ["RES002", "Physics Laboratory", "Laboratory", "Block B - Room 205", 30, "Fully equipped physics laboratory for practical experiments."],
        ["RES003", "Seminar Hall", "Auditorium", "Main Block", 150, "Spacious seminar hall with projector and sound system."],
        ["RES004", "Smart Classroom", "Classroom", "Block C - Room 302", 60, "Smart classroom equipped with digital teaching facilities."],
        ["RES005", "Indoor Sports Hall", "Sports", "Sports Complex", 50, "Indoor facility for sports and recreational activities."],
        ["RES007", "Central Library", "Library", "Knowledge Centre - Ground Floor", 200, "Central reading space with individual study desks and reference books."],
        ["RES008", "Biology Laboratory", "Laboratory", "Block B - Room 215", 28, "Biology lab with microscopes and practical learning equipment."],
        ["RES009", "Basketball Court", "Sports", "Outdoor Sports Complex", 30, "Outdoor basketball court for practice and campus activities."],
        ["RES010", "Gymnasium", "Sports", "Sports Complex - Ground Floor", 35, "Indoor fitness facility with exercise equipment."],
        ["RES011", "Conference Room", "Classroom", "Administrative Block - Room 305", 24, "Conference space for group discussions, presentations and project reviews."],
        ["RES012", "Projector and AV Kit", "Equipment", "Central IT Desk", 1, "Portable projector and audio-visual equipment for classroom use."],
        ["RES013", "Medical Room", "Other", "Student Services Block", 8, "Campus first-aid and student wellness room. Booking is for room use only."]
    ].map(([id, name, category, location, capacity, description]) => ({ id, name, category, location, capacity, description, status: "Available" }));

    if (!localStorage.getItem(DB.resources)) {
        saveData(DB.resources, seedResources);
        localStorage.setItem("campusbook_extra_resources_v1", "true");
    } else {
        let res = getData(DB.resources).map(r => ({ ...r, status: r.status || "Available" }));
        if (!localStorage.getItem("campusbook_extra_resources_v1")) {
            const ids = new Set(res.map(r => r.id));
            res = [...res, ...seedResources.slice(5).filter(r => !ids.has(r.id))];
            localStorage.setItem("campusbook_extra_resources_v1", "true");
        }
        saveData(DB.resources, res);
    }
    if (!localStorage.getItem(DB.bookings)) saveData(DB.bookings, []);
}

function removeExpiredBookings() {
    const today = localDateString(), bookings = getData(DB.bookings);
    const active = bookings.filter(b => !b.date || b.date >= today);
    if (active.length !== bookings.length) saveData(DB.bookings, active);
    return active.length !== bookings.length;
}

/* --- AUTHENTICATION --- */
function setRole(role) {
    currentRole = role;
    $("studentRole").classList.toggle("active", role === "student");
    $("adminRole").classList.toggle("active", role === "admin");
    $("authMessage").textContent = "";
    if (role === "admin" && authMode === "register") setAuthMode("login");
    $("authEmailLabel").textContent = role === "admin" ? "Username" : "Email Address";
    $("authSwitch").classList.toggle("hidden", role === "admin");
}

function setAuthMode(mode) {
    if (currentRole === "admin" && mode === "register") return;
    authMode = mode;
    const isReg = mode === "register";
    $("nameGroup").classList.toggle("hidden", !isReg);
    $("studentIdGroup").classList.toggle("hidden", !isReg);
    $("authName").required = $("authStudentId").required = isReg;
    $("authTitle").textContent = isReg ? "Create your account" : "Welcome back!";
    $("authSubtitle").textContent = isReg ? "Register to start using campus facilities." : "Sign in to access your campus dashboard.";
    $("authSubmit").innerHTML = isReg ? 'Create Account <i class="fa-solid fa-user-plus"></i>' : 'Sign In <i class="fa-solid fa-arrow-right"></i>';
    $("authSwitch").innerHTML = isReg
        ? `Already have an account? <button type="button" onclick="setAuthMode('login')">Sign In</button>`
        : `Don't have an account? <button type="button" onclick="setAuthMode('register')">Create Account</button>`;
    $("authSwitch").classList.toggle("hidden", currentRole === "admin");
    $("authMessage").textContent = "";
}

$("authForm").addEventListener("submit", function (e) {
    e.preventDefault();
    const email = $("authEmail").value.trim().toLowerCase(), password = $("authPassword").value;
    const name = $("authName").value.trim(), studentId = $("authStudentId").value.trim();
    const users = getData(DB.users);

    if (authMode === "register") {
        if (currentRole !== "student") return;
        if (name.length < 3 || studentId.length < 2) return $("authMessage").textContent = "Enter valid student details.";
        if (!email.includes("@") || !email.includes(".")) return $("authMessage").textContent = "Enter a valid email address.";
        if (password.length < 6) return $("authMessage").textContent = "Password must contain at least 6 characters.";
        if (users.some(u => u.email.toLowerCase() === email || u.studentId?.toLowerCase() === studentId.toLowerCase()))
            return $("authMessage").textContent = "Email or Student ID is already registered.";

        users.push({ id: makeId("STU"), name, studentId, email, password, role: "student" });
        saveData(DB.users, users);
        this.reset();
        setAuthMode("login");
        $("authEmail").value = email;
        return showToast("Registration successful. Please sign in.");
    }

    let user = users.find(u => u.role === currentRole && u.email.toLowerCase() === email && u.password === password);
    if (!user && currentRole === "admin" && ["admin", "admin@campus.com"].includes(email) && password === "admin@123")
        user = users.find(u => u.role === "admin");
    if (!user) return $("authMessage").textContent = "Invalid username or password.";

    currentUser = user;
    saveData(DB.session, { id: user.id, role: user.role });
    this.reset();
    openApplication();
});

function openApplication() {
    $("authSection").classList.add("hidden");
    $("appSection").classList.remove("hidden");
    const isAdmin = currentUser.role === "admin";
    $("adminNavigation").classList.toggle("hidden", !isAdmin);
    $("studentNavigation").classList.toggle("hidden", isAdmin);

    $("sidebarName").textContent = $("topName").textContent = currentUser.name;
    $("sidebarRole").textContent = isAdmin ? "Administrator" : "Student";
    $("topRole").textContent = isAdmin ? "Admin" : "Student";
    $("sidebarAvatar").textContent = $("topAvatar").textContent = currentUser.name[0].toUpperCase();

    if (!isAdmin) $("welcomeStudent").textContent = currentUser.name.split(" ")[0];
    navigate(isAdmin ? "dashboard" : "studentDashboard");
}

function logout() {
    if (!confirm("Are you sure you want to logout?")) return;
    currentUser = null;
    localStorage.removeItem(DB.session);
    $("appSection").classList.add("hidden");
    $("authSection").classList.remove("hidden");
    $("authForm").reset();
    setRole("student");
    setAuthMode("login");
    showToast("Logged out successfully.");
}

/* --- NAVIGATION & RENDER ROUTING --- */
const pageMeta = {
    dashboard: ["Dashboard", "Monitor campus resources and activities.", "admin", renderDashboard],
    resources: ["Manage Resources", "Add, update and remove campus facilities.", "admin", renderResources],
    bookings: ["Manage Bookings", "Review student booking requests.", "admin", renderAdminBookings],
    students: ["Manage Students", "View registered student accounts.", "admin", renderStudents],
    studentDashboard: ["Student Dashboard", "Welcome to your campus dashboard.", "student", renderStudentDashboard],
    browse: ["Browse Resources", "Find and book campus facilities.", "student", renderStudentResources],
    myBookings: ["My Bookings", "Track your booking requests.", "student", renderMyBookings]
};

function navigate(page) {
    const meta = pageMeta[page];
    if (!currentUser || !meta || currentUser.role !== meta[2] || !$("page-" + page)) return;
    document.querySelectorAll(".page").forEach(p => p.classList.add("hidden"));
    $("page-" + page).classList.remove("hidden");
    document.querySelectorAll(".nav-link").forEach(l => l.classList.toggle("active", l.dataset.page === page));
    $("topbarTitle").textContent = meta[0];
    $("topbarSubtitle").textContent = meta[1];
    meta[3]();
}

const statusBadge = s => `<span class="status ${escapeHTML(String(s).toLowerCase().replace(/\s+/g, "-"))}">${escapeHTML(s)}</span>`;

/* --- ADMIN: RESOURCES --- */
function openResourceForm(id = null) {
    if (currentUser?.role !== "admin") return;
    $("resourceForm").reset();
    $("resourceEditId").value = "";
    const r = id && getData(DB.resources).find(x => x.id === id);
    if (id && !r) return;

    if (r) {
        $("resourceEditId").value = r.id;
        $("resourceName").value = r.name;
        $("resourceCategory").value = r.category;
        $("resourceLocation").value = r.location;
        $("resourceCapacity").value = r.capacity;
        $("resourceDescription").value = r.description || "";
        $("resourceStatus").value = r.status || "Available";
        $("resourceFormTitle").textContent = "Edit Resource";
    } else {
        $("resourceStatus").value = "Available";
        $("resourceFormTitle").textContent = "Add New Resource";
    }
    $("resourceFormPanel").classList.remove("hidden");
    $("resourceFormPanel").scrollIntoView({ behavior: "smooth", block: "start" });
}

function closeResourceForm() {
    $("resourceFormPanel").classList.add("hidden");
    $("resourceForm").reset();
    $("resourceEditId").value = "";
}

$("resourceForm").addEventListener("submit", function (e) {
    e.preventDefault();
    if (currentUser?.role !== "admin") return;
    let list = getData(DB.resources);
    const editId = $("resourceEditId").value;
    const item = {
        id: editId || makeId("RES"),
        name: $("resourceName").value.trim(),
        category: $("resourceCategory").value,
        location: $("resourceLocation").value.trim(),
        capacity: Number($("resourceCapacity").value),
        description: $("resourceDescription").value.trim(),
        status: $("resourceStatus").value
    };
    if (!item.name || !item.category || !item.location || !Number.isInteger(item.capacity) || item.capacity < 1 || !["Available", "Not Available"].includes(item.status))
        return showToast("Please enter valid resource details.");

    list = editId ? list.map(r => r.id === editId ? item : r) : [...list, item];
    saveData(DB.resources, list);
    showToast(editId ? "Resource updated successfully!" : "New resource added successfully!");
    closeResourceForm();
    renderResources();
    renderDashboard();
});

function renderResources() {
    if (currentUser?.role !== "admin") return;
    const q = $("adminResourceSearch").value.toLowerCase().trim(), cat = $("adminCategoryFilter").value;
    const filtered = getData(DB.resources).filter(r =>
        (!cat || r.category === cat) && [r.name, r.id, r.location, r.category].some(f => f.toLowerCase().includes(q))
    );
    $("adminResourceList").innerHTML = filtered.map(r => {
        const st = r.status || "Available", id = escapeHTML(r.id);
        return `<tr>
            <td><span class="resource-id">${id}</span></td>
            <td><strong>${escapeHTML(r.name)}</strong></td>
            <td>${escapeHTML(r.category)}</td>
            <td>${escapeHTML(r.location)}</td>
            <td>${Number(r.capacity)}</td>
            <td><select class="resource-status-select ${st === "Available" ? "available" : "unavailable"}" onchange="updateResourceStatus('${id}', this.value)">
                <option value="Available" ${st === "Available" ? "selected" : ""}>Available</option>
                <option value="Not Available" ${st === "Not Available" ? "selected" : ""}>Not Available</option>
            </select></td>
            <td><div class="resource-actions">
                <button class="resource-action-btn" title="Edit Resource" onclick="openResourceForm('${id}')"><i class="fa-solid fa-pen"></i></button>
                <button class="resource-action-btn delete" title="Delete Resource" onclick="deleteResource('${id}')"><i class="fa-solid fa-trash"></i></button>
            </div></td>
        </tr>`;
    }).join("");
    $("resourceEmpty").classList.toggle("hidden", filtered.length > 0);
}

function updateResourceStatus(id, status) {
    if (currentUser?.role !== "admin") return;
    if (!["Available", "Not Available"].includes(status)) { showToast("Invalid resource status."); return renderResources(); }
    const list = getData(DB.resources), res = list.find(r => r.id === id);
    if (!res) return;
    res.status = status;
    saveData(DB.resources, list);
    renderResources();
    renderDashboard();
    showToast(`Resource status changed to ${status}.`);
}

function deleteResource(id) {
    if (currentUser?.role !== "admin") return;
    if (getData(DB.bookings).some(b => b.resourceId === id && ["Pending", "Approved"].includes(b.status)))
        return showToast("Cannot delete a resource with active bookings.");
    if (!confirm("Are you sure you want to delete this resource?")) return;
    saveData(DB.resources, getData(DB.resources).filter(r => r.id !== id));
    renderResources();
    renderDashboard();
    showToast("Resource deleted successfully.");
}

/* --- SHARED RESOURCE CARD & STUDENT BROWSE --- */
const categoryIcons = { Laboratory: "fa-flask", Classroom: "fa-chalkboard", Auditorium: "fa-building", Sports: "fa-volleyball", Library: "fa-book-open", Equipment: "fa-display", Other: "fa-door-open" };

function resourceCard(r) {
    const st = r.status || "Available", ok = st === "Available";
    return `<article class="resource-card">
        <div class="resource-card-icon"><i class="fa-solid ${categoryIcons[r.category] || "fa-building"}"></i></div>
        <div class="resource-card-content">
            <span class="category-badge">${escapeHTML(r.category)}</span>
            <h3>${escapeHTML(r.name)}</h3>
            <p><i class="fa-solid fa-location-dot"></i> ${escapeHTML(r.location)}</p>
            <p><i class="fa-solid fa-users"></i> Capacity: ${Number(r.capacity)} people</p>
            <p>${escapeHTML(r.description)}</p>
            <p><span class="resource-status-text ${ok ? "available" : "unavailable"}"><i class="fa-solid ${ok ? "fa-circle-check" : "fa-circle-xmark"}"></i> ${st}</span></p>
            ${ok
                ? `<button class="primary-btn" onclick="openBookingModal('${escapeHTML(r.id)}')"><i class="fa-solid fa-calendar-plus"></i> Book Now</button>`
                : `<button class="unavailable-btn" disabled><i class="fa-solid fa-ban"></i> Not Available</button>`}
        </div>
    </article>`;
}

function renderStudentResources() {
    if (currentUser?.role !== "student") return;
    const q = $("studentResourceSearch").value.toLowerCase().trim(), cat = $("studentCategoryFilter").value;
    const filtered = getData(DB.resources).filter(r =>
        (!cat || r.category === cat) && [r.name, r.location, r.category].some(f => f.toLowerCase().includes(q))
    );
    $("studentResourceList").innerHTML = filtered.length
        ? filtered.map(resourceCard).join("")
        : `<div class="empty-state"><i class="fa-solid fa-building-circle-xmark"></i><h3>No resources found</h3><p>Try another search.</p></div>`;
}

/* --- ADMIN DASHBOARD, BOOKINGS & STUDENTS --- */
function renderDashboard() {
    const bookings = getData(DB.bookings);
    $("totalResources").textContent = getData(DB.resources).length;
    $("totalBookings").textContent = bookings.length;
    $("pendingBookings").textContent = bookings.filter(b => b.status === "Pending").length;
    $("totalStudents").textContent = getData(DB.users).filter(u => u.role === "student").length;
}

function renderAdminBookings() {
    const q = $("adminBookingSearch").value.toLowerCase().trim(), st = $("bookingStatusFilter").value;
    const filtered = [...getData(DB.bookings)].reverse().filter(b =>
        (!st || b.status === st) && [b.id, b.studentName, b.resourceName].some(f => f.toLowerCase().includes(q))
    );
    $("adminBookingList").innerHTML = filtered.length ? filtered.map(b => {
        const id = escapeHTML(b.id);
        return `<tr>
            <td>${id}</td><td>${escapeHTML(b.studentName)}</td><td>${escapeHTML(b.resourceName)}</td>
            <td>${escapeHTML(b.date)}</td><td>${escapeHTML(b.time)}</td><td>${statusBadge(b.status)}</td>
            <td>${b.status === "Pending"
                ? `<button class="approve-btn" onclick="updateBookingStatus('${id}','Approved')">Approve</button> <button class="reject-btn" onclick="updateBookingStatus('${id}','Rejected')">Reject</button>`
                : "-"}</td>
        </tr>`;
    }).join("") : `<tr><td colspan="7">No bookings found.</td></tr>`;
}

function updateBookingStatus(id, status) {
    if (currentUser?.role !== "admin" || !["Approved", "Rejected"].includes(status)) return;
    const bookings = getData(DB.bookings), b = bookings.find(x => x.id === id);
    if (!b || b.status !== "Pending") return showToast("This request is no longer pending.");

    if (status === "Approved") {
        const res = getData(DB.resources).find(r => r.id === b.resourceId);
        if (!res || res.status === "Not Available") return showToast("This resource is currently unavailable.");
        if (bookings.some(x => x.id !== id && x.resourceId === b.resourceId && x.date === b.date && x.time === b.time && x.status === "Approved"))
            return showToast("This resource is already approved for this slot.");
    }
    b.status = status;
    saveData(DB.bookings, bookings);
    renderAdminBookings();
    renderDashboard();
    showToast(`Booking ${status.toLowerCase()} successfully.`);
}

function renderStudents() {
    const students = getData(DB.users).filter(u => u.role === "student");
    $("studentList").innerHTML = students.length
        ? students.map(s => `<tr><td>${escapeHTML(s.studentId || s.id)}</td><td><strong>${escapeHTML(s.name)}</strong></td><td>${escapeHTML(s.email)}</td><td>Student</td></tr>`).join("")
        : `<tr><td colspan="4">No registered students.</td></tr>`;
}

/* --- STUDENT DASHBOARD & BOOKINGS --- */
function renderStudentDashboard() {
    const res = getData(DB.resources), mine = getData(DB.bookings).filter(b => b.studentId === currentUser.id);
    $("studentResourceCount").textContent = res.filter(r => (r.status || "Available") === "Available").length;
    $("studentBookingCount").textContent = mine.length;
    $("studentPendingCount").textContent = mine.filter(b => b.status === "Pending").length;
    $("studentFeaturedResources").innerHTML = res.length ? res.slice(0, 3).map(resourceCard).join("") : `<div class="empty-state"><h3>No resources available</h3></div>`;
}

function openBookingModal(resourceId) {
    if (currentUser?.role !== "student") return;
    const res = getData(DB.resources).find(r => r.id === resourceId);
    if (!res) return;
    if (res.status === "Not Available") return showToast("Sorry, this resource is currently unavailable.");
    $("bookingForm").reset();
    $("bookingResourceId").value = res.id;
    $("bookingResourceName").value = res.name;
    $("bookingDate").min = localDateString();
    $("bookingModal").classList.remove("hidden");
}

function closeBookingModal() {
    $("bookingModal").classList.add("hidden");
    $("bookingForm").reset();
}

$("bookingForm").addEventListener("submit", function (e) {
    e.preventDefault();
    if (currentUser?.role !== "student") return;
    const res = getData(DB.resources).find(r => r.id === $("bookingResourceId").value);
    const date = $("bookingDate").value, time = $("bookingTime").value, purpose = $("bookingPurpose").value.trim();

    if (!res) return showToast("Resource not found.");
    if (res.status === "Not Available") return showToast("This resource is currently unavailable.");
    if (!date || !time || !purpose) return showToast("Complete all booking details.");
    if (date < localDateString()) return showToast("Select today or a future date.");

    const bookings = getData(DB.bookings);
    if (bookings.some(b => b.resourceId === res.id && b.date === date && b.time === time && ["Pending", "Approved"].includes(b.status)))
        return showToast("This resource is already requested or booked.");

    bookings.push({
        id: makeId("BK"), studentId: currentUser.id, studentName: currentUser.name,
        resourceId: res.id, resourceName: res.name, location: res.location,
        date, time, purpose, status: "Pending", createdAt: new Date().toISOString()
    });
    saveData(DB.bookings, bookings);
    closeBookingModal();
    renderStudentDashboard();
    showToast("Booking request submitted successfully.");
});

function renderMyBookings() {
    const mine = getData(DB.bookings).filter(b => b.studentId === currentUser.id).reverse();
    $("myBookingList").innerHTML = mine.length ? mine.map(b => `<tr>
        <td>${escapeHTML(b.id)}</td><td>${escapeHTML(b.resourceName)}</td><td>${escapeHTML(b.date)}</td>
        <td>${escapeHTML(b.time)}</td><td>${escapeHTML(b.purpose)}</td><td>${statusBadge(b.status)}</td>
        <td>${b.status === "Pending" ? `<button class="cancel-form-btn" onclick="cancelBooking('${escapeHTML(b.id)}')">Cancel</button>` : "-"}</td>
    </tr>`).join("") : `<tr><td colspan="7">You have not made any bookings yet.</td></tr>`;
}

function cancelBooking(id) {
    if (!confirm("Cancel this booking request?")) return;
    const bookings = getData(DB.bookings), b = bookings.find(x => x.id === id && x.studentId === currentUser.id);
    if (!b || b.status !== "Pending") return showToast("Only pending bookings can be cancelled.");
    b.status = "Cancelled";
    saveData(DB.bookings, bookings);
    renderMyBookings();
    renderStudentDashboard();
    showToast("Booking cancelled successfully.");
}

$("bookingModal").addEventListener("click", e => { if (e.target === e.currentTarget) closeBookingModal(); });

/* --- APP LIFECYCLE & SLIDESHOW --- */
function refreshAfterExpiry() {
    const activePage = document.querySelector(".page:not(.hidden)")?.id?.replace("page-", "");
    if (currentUser && pageMeta[activePage]) pageMeta[activePage][3]();
}

function showLoginSlide(idx) {
    const slides = document.querySelectorAll(".login-slide"), dots = document.querySelectorAll(".login-slide-dot");
    if (!slides.length) return;
    slideIdx = (idx + slides.length) % slides.length;
    slides.forEach((s, i) => s.classList.toggle("active", i === slideIdx));
    dots.forEach((d, i) => d.classList.toggle("active", i === slideIdx));
}

function startLoginSlideshow() {
    if (!document.querySelector(".login-slide")) return;
    clearInterval(slideTimer);
    showLoginSlide(0);
    slideTimer = setInterval(() => showLoginSlide(slideIdx + 1), 4000);
}

(function startApplication() {
    initializeDatabase();
    removeExpiredBookings();
    $("currentDate").textContent = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    $("bookingDate").min = localDateString();

    const session = getData(DB.session, null);
    currentUser = session && getData(DB.users).find(u => u.id === session.id && u.role === session.role);
    if (currentUser) openApplication();
    else localStorage.removeItem(DB.session);

    setRole("student");
    setAuthMode("login");
    startLoginSlideshow();
})();

setInterval(() => { if (removeExpiredBookings()) refreshAfterExpiry(); }, 60000);
document.addEventListener("visibilitychange", () => document.hidden ? clearInterval(slideTimer) : startLoginSlideshow());