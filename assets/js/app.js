/* =====================================================================
   Everwell Dental — shared page behaviour (static prototype)

   Is file ko data.js ke BAAD load karna hai:
     <script src="assets/js/data.js"></script>
     <script src="assets/js/app.js"></script>

   Drupal mein: localStorage ki jagah entities / Views / role-protected routes.

   ---------------------------------------------------------------------
   KYA KAHAN HAI (table of contents)
   ---------------------------------------------------------------------
   1. Setup & helpers ........ data, $, esc, dates, status helpers
   2. Appointment storage .... localStorage read / save / admin notice
   3. Site layout ............ header + footer            (ALL pages)
   4. HTML builders .......... doctor card, detail grid, status pill
   5. Pages (har page ka apna function)
        home .................. index.html
        services .............. services.html
        doctors ............... doctors.html
        doctor ................ doctor.html          (?doctor=ID)
        booking ............... booking.html         (?doctor=ID&service=NAME)
        dashboard ............. dashboard.html       (clinic/admin)
        doctor-dashboard ...... doctor-dashboard.html (?doctor=ID)
   6. Date-wise schedule ..... dono dashboards use karte hain
   7. Start .................. header/footer + current page ka init
   ===================================================================== */
(() => {
  'use strict';

  /* ===================================================================
     1. SETUP & HELPERS
     =================================================================== */

  const data = window.EVERWELL_DATA || { doctors: [], services: [], appointments: [] };
  const page = document.body.dataset.page || '';   // <body data-page="booking">
  const params = new URLSearchParams(location.search);

  /** Shortcut: document.getElementById */
  const $ = id => document.getElementById(id);

  /** Escape text before putting it inside innerHTML. */
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));

  const url = encodeURIComponent;
  const findDoctor = id => data.doctors.find(d => d.id === id);
  const findDoctorByName = name => data.doctors.find(d => d.name === name);

  /* ---- Status helpers -------------------------------------------------- */

  const isPending = a => a.status === 'Pending review' || a.status === 'Pending';

  /** CSS modifier for .table-status */
  const statusClass = status =>
    status === 'Pending review' ? 'review' :
    status === 'Rejected'       ? 'rejected' :
    status === 'Pending'        ? 'pending' : '';

  // ---- Date helpers ----------------------------------------------------

  /** "Wednesday, Oct 14, 2026" (schedule headings) */
  const formatLongDate = value => {
    if (!value) return 'Date not set';
    const parsed = new Date(`${value}T12:00:00`);
    return Number.isNaN(parsed.getTime())
      ? value
      : parsed.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
  };

  /** "Oct 14, 2026" (booking confirmation) */
  const formatShortDate = value =>
    new Date(`${value}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  /** "2026-10-14" in local time (min value of <input type="date">) */
  const todayISO = () => {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
  };

  /** Array.sort comparator: earliest date + time first, undated last. */
  const byDateTime = (a, b) =>
    `${a.date || '9999-12-31'} ${a.time || ''}`.localeCompare(`${b.date || '9999-12-31'} ${b.time || ''}`);


  /* ===================================================================
     2. APPOINTMENT STORAGE  (browser localStorage — demo only)
     =================================================================== */

  const STORAGE = {
    appointments: 'everwellAppointments',
    lastUpdate:   'everwellLastUpdate',
    adminNotice:  'everwellAdminNotification',
    dashboardNotifications: 'everwellDashboardNotifications'
  };

  /** First visit: turn data.appointments (data.js) into full appointment records. */
  const seedAppointments = () => {
    const seeded = data.appointments.map((a, i) => ({
      ...a,
      id: `EW-DEMO-${1001 + i}`,
      doctorId: findDoctorByName(a.doctor)?.id || data.doctors[i % data.doctors.length]?.id || '',
      date: '2026-10-14',
      phone: '(555) 010-0000',
      clinic: 'Everwell Dental — Downtown',
      reason: a.service,
      notes: 'Sample appointment for design review.',
      status: a.status === 'Pending' ? 'Pending review' : a.status,
      queueStatus: 'waiting',
      notified: false
    }));
    localStorage.setItem(STORAGE.appointments, JSON.stringify(seeded));
    return seeded;
  };

  const readAppointments = () => {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE.appointments) || 'null');
      if (Array.isArray(stored)) return stored;
    } catch (e) { /* broken JSON → reseed below */ }
    return seedAppointments();
  };

  const saveAppointments = rows => {
    localStorage.setItem(STORAGE.appointments, JSON.stringify(rows));
    localStorage.setItem(STORAGE.lastUpdate, String(Date.now()));
  };

  /** Message shown at the top of the clinic dashboard. */
  const setAdminNotice = (message, appointmentId) =>
    localStorage.setItem(STORAGE.adminNotice, JSON.stringify({ message, at: Date.now(), appointmentId }));

  const getAdminNotice = () => {
    try { return JSON.parse(localStorage.getItem(STORAGE.adminNotice) || 'null'); }
    catch (e) { return null; }
  };

  /* ---- Dashboard notification center + patient queue ---------------- */
  const getDashboardNotifications = () => readJSON(STORAGE.dashboardNotifications, []);
  const addDashboardNotification = notification => {
    const items = getDashboardNotifications();
    items.unshift({ ...notification, id: `AL-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`, createdAt: new Date().toISOString(), read: false });
    localStorage.setItem(STORAGE.dashboardNotifications, JSON.stringify(items.slice(0, 100)));
    localStorage.setItem(STORAGE.lastUpdate, String(Date.now()));
    window.dispatchEvent(new Event('everwell:notification'));
  };
  const queueLabel = appointment => appointment.queueStatus === 'called' ? 'Called' : appointment.queueStatus === 'checked-in' ? 'Checked in' : 'Waiting';
  const notifyPatient = (appointment, type, message, channels = ['SMS', 'WhatsApp']) => addNotification({ appointmentId: appointment.id, patient: appointment.patient, doctorId: appointment.doctorId, channels, type, message });

  /* ---- Emergency workflow storage (demo only) ----------------------- */
  const EMERGENCY_KEYS = {
    statuses: 'everwellDoctorStatuses',
    notifications: 'everwellPatientNotifications'
  };
  const readJSON = (key, fallback) => {
    try {
      const value = JSON.parse(localStorage.getItem(key) || 'null');
      return value ?? fallback;
    } catch (e) { return fallback; }
  };
  const saveJSON = (key, value) => localStorage.setItem(key, JSON.stringify(value));
  const getDoctorStatuses = () => readJSON(EMERGENCY_KEYS.statuses, {});
  const getDoctorStatus = doctorId => getDoctorStatuses()[doctorId] || { status: 'Available' };
  const setDoctorStatus = (doctorId, status) => {
    const statuses = getDoctorStatuses();
    statuses[doctorId] = status;
    saveJSON(EMERGENCY_KEYS.statuses, statuses);
    window.dispatchEvent(new Event('everwell:updated'));
  };
  const getNotifications = () => readJSON(EMERGENCY_KEYS.notifications, []);
  const addNotification = notification => {
    const notifications = getNotifications();
    notifications.unshift({ ...notification, id: `NT-${Date.now()}`, sentAt: new Date().toISOString(), delivery: 'Delivered (demo)' });
    saveJSON(EMERGENCY_KEYS.notifications, notifications.slice(0, 100));
  };
  const timeToMinutes = value => {
    const match = String(value || '').match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (!match) return null;
    let hour = Number(match[1]);
    if (match[3].toUpperCase() === 'PM' && hour !== 12) hour += 12;
    if (match[3].toUpperCase() === 'AM' && hour === 12) hour = 0;
    return hour * 60 + Number(match[2]);
  };
  const emergencyIsActive = status => status?.status === 'Emergency Away' && (!status.until || new Date(status.until).getTime() > Date.now());
  const isUrgentAppointment = appointment => /severe|pain|emergency|swelling/i.test(`${appointment.reason || ''} ${appointment.notes || ''} ${appointment.service || ''}`);
  const affectedByEmergency = (appointment, doctorId, emergency) => {
    if (appointment.doctorId !== doctorId || !emergencyIsActive(emergency)) return false;
    if (emergency.duration === 'specific-date') return appointment.date === emergency.date;
    if (emergency.duration === 'whole-day') return appointment.date === todayISO();
    if (emergency.duration === '2-hours') {
      if (appointment.date !== todayISO()) return false;
      const appointmentMinutes = timeToMinutes(appointment.time);
      const now = new Date();
      const nowMinutes = now.getHours() * 60 + now.getMinutes();
      return appointmentMinutes === null || (appointmentMinutes >= nowMinutes && appointmentMinutes <= nowMinutes + 120);
    }
    return false;
  };
  const notifyAffectedPatients = (doctor, affected, emergency) => {
    affected.forEach(appointment => addNotification({
      appointmentId: appointment.id,
      patient: appointment.patient,
      channels: ['SMS', 'WhatsApp', 'Email'],
      message: `Dear ${appointment.patient}, due to an emergency, ${doctor.name} is unavailable. We apologize for the inconvenience. Please reschedule or connect with our receptionist.`,
      type: 'Emergency availability alert',
      doctorId: doctor.id,
      duration: emergency.duration
    }));
  };


  /* ===================================================================
     3. SITE LAYOUT — header & footer  (injected on every page)
         <div id="site-header"></div>  /  <div id="site-footer"></div>
     =================================================================== */

  const NAV_LINKS = [
    ['home',             'Home',             'index.html'],
    ['services',         'Services',         'services.html'],
    ['about',            'About',            'about.html'],
    ['doctors',          'Our doctors',      'doctors.html'],
    ['dashboard',        'Clinic dashboard', 'dashboard.html'],
    ['doctor-dashboard', 'Doctor dashboard', 'doctor-dashboard.html']
  ];

  const brandLink = ariaLabel => `
    <a class="brand" href="index.html"${ariaLabel ? ` aria-label="${ariaLabel}"` : ''}>
      <span class="brand-mark">✦</span><span>everwell<small>D E N T A L</small></span>
    </a>`;

  const showDashboardToast = notification => {
    const toast = document.createElement('div');
    toast.className = 'alert-toast';
    toast.innerHTML = `<strong>🔔 New patient alert</strong><p>${esc(notification.message)}</p>`;
    document.body.appendChild(toast);
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        const context = new AudioContext();
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.frequency.value = 880;
        gain.gain.setValueAtTime(0.04, context.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.25);
        oscillator.connect(gain).connect(context.destination);
        oscillator.start(); oscillator.stop(context.currentTime + 0.25);
      }
    } catch (e) { /* browser audio permission is optional in this demo */ }
    setTimeout(() => toast.remove(), 5000);
  };

  const renderNotificationCenter = () => {
    if (!['dashboard', 'doctor-dashboard'].includes(page)) return;
    const host = document.createElement('div');
    host.id = 'notification-center';
    host.className = 'notification-center';
    host.innerHTML = `<button id="notification-bell" class="notification-bell" type="button" aria-expanded="false" aria-controls="notification-dropdown">🔔<span id="notification-badge" class="notification-badge" hidden>0</span></button><div id="notification-dropdown" class="notification-dropdown" hidden><div class="notification-dropdown-heading"><strong>Notifications</strong><span>Live queue alerts</span></div><div id="notification-items"></div></div>`;
    const navWrap = document.querySelector('.nav-wrap');
    navWrap?.querySelector('.nav-cta')?.before(host);
    const bell = $('notification-bell');
    const dropdown = $('notification-dropdown');
    let lastKnown = new Set(getDashboardNotifications().map(n => n.id));
    const relevant = () => {
      const selectedDoctor = params.get('doctor');
      return getDashboardNotifications().filter(n => page === 'dashboard' || (n.audience !== 'clinic' && (!selectedDoctor || n.doctorId === selectedDoctor)));
    };
    const render = () => {
      const items = relevant();
      const unread = items.filter(n => !n.read).length;
      const badge = $('notification-badge');
      badge.hidden = !unread;
      badge.textContent = unread > 9 ? '9+' : unread;
      $('notification-items').innerHTML = items.length ? items.slice(0, 12).map(n => `<div class="notification-item ${n.read ? '' : 'unread'}"><span class="notification-item-icon">${n.type === 'Patient arrived' ? '🏥' : '🕒'}</span><div><strong>${esc(n.message)}</strong><small>${new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · ${esc(n.type)}</small></div></div>`).join('') : '<p class="notification-empty">No new patient alerts.</p>';
    };
    const markRead = () => {
      const ids = new Set(relevant().map(n => n.id));
      const updated = getDashboardNotifications().map(n => ids.has(n.id) ? { ...n, read: true } : n);
      localStorage.setItem(STORAGE.dashboardNotifications, JSON.stringify(updated));
      render();
    };
    bell.addEventListener('click', () => {
      const open = dropdown.hidden;
      dropdown.hidden = !open;
      bell.setAttribute('aria-expanded', String(open));
      if (open) markRead();
    });
    const poll = () => {
      const items = relevant();
      const latest = items.find(n => !lastKnown.has(n.id));
      if (latest && document.visibilityState !== 'hidden') showDashboardToast(latest);
      lastKnown = new Set(getDashboardNotifications().map(n => n.id));
      render();
    };
    window.addEventListener('everwell:notification', poll);
    window.addEventListener('storage', poll);
    setInterval(poll, 5000);
    render();
  };

  const renderHeader = () => {
    const host = $('site-header');
    if (!host) return;

    const links = NAV_LINKS
      .map(([key, label, href]) => `<a class="${page === key ? 'active' : ''}" href="${href}">${label}</a>`)
      .join('');

    host.innerHTML = `
      <header class="site-header">
        <div class="nav-wrap">
          ${brandLink('Everwell Dental home')}
          <button class="menu-toggle" id="menu-toggle" aria-expanded="false" aria-controls="main-nav">☰ <span class="sr-only">Open menu</span></button>
          <nav id="main-nav" class="nav-links" aria-label="Main navigation">
            ${links}
            <a class="mobile-cta" href="booking.html">Book an appointment ↗</a>
          </nav>
          <a class="nav-cta" href="booking.html">Book appointment ↗</a>
        </div>
      </header>`;

    renderNotificationCenter();

    // Mobile menu open / close
    const toggle = $('menu-toggle');
    const nav = $('main-nav');
    toggle.addEventListener('click', () => {
      const open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(open));
      toggle.innerHTML = open
        ? '× <span class="sr-only">Close menu</span>'
        : '☰ <span class="sr-only">Open menu</span>';
    });
  };

  const renderFooter = () => {
    const host = $('site-footer');
    if (!host) return;

    host.innerHTML = `
      <footer class="site-footer">
        <div class="footer-grid">
          <div>
            ${brandLink()}
            <p class="footer-copy">Thoughtful modern dentistry, designed around your comfort, confidence, and long-term oral health.</p>
          </div>
          <div>
            <p class="footer-title">EXPLORE</p>
            <div class="footer-links">
              <a href="services.html">Dental services</a>
              <a href="doctors.html">Meet our doctors</a>
              <a href="about.html">About Everwell</a>
              <a href="booking.html">Book an appointment</a>
            </div>
          </div>
          <div>
            <p class="footer-title">WORKSPACES</p>
            <div class="footer-links">
              <a href="dashboard.html">Clinic dashboard</a>
              <a href="doctor-dashboard.html">Doctor dashboard</a>
            </div>
          </div>
          <div>
            <p class="footer-title">VISIT US</p>
            <div class="footer-links">
              <span>1200 Market Street</span>
              <span>Suite 240, Austin, TX</span>
              <span>Mon–Fri: 8 AM–5 PM</span>
              <span>Sat: 9 AM–1 PM</span>
            </div>
          </div>
        </div>
        <div class="footer-bottom">
          <span>© ${new Date().getFullYear()} Everwell Dental · Design prototype</span>
          <span>Sample clinic details · Not a live healthcare service</span>
        </div>
      </footer>`;
  };


  /* ===================================================================
     4. HTML BUILDERS  (small pieces reused on several pages)
     =================================================================== */

  /** <span class="table-status">  → clinic table, doctor dashboard, schedules */
  const statusPill = status =>
    `<span class="table-status ${statusClass(status)}">${esc(status)}</span>`;

  /** Grid of "label / value" boxes → doctor profile, both dashboards.
      items = [['Email', 'a@b.com'], ['Phone', '555…']] */
  const detailGrid = items => `
    <div class="detail-card">
      ${items.map(([label, value]) => `<div><small>${esc(label)}</small><strong>${esc(value)}</strong></div>`).join('')}
    </div>`;

  /** Doctor card → home (featured) + doctors directory */
  const doctorCard = d => `
    <article class="doctor-card">
      <div class="doctor-image-wrap">
        <a href="doctor.html?doctor=${url(d.id)}" aria-label="View ${esc(d.name)} profile">
          <img src="${esc(d.image)}" alt="Portrait of ${esc(d.name)}" loading="lazy">
        </a>
        <span class="doctor-badge">${esc(d.specialty)}</span>
      </div>
      <div class="doctor-info">
        <h3><a href="doctor.html?doctor=${url(d.id)}">${esc(d.name)}</a></h3>
        <p class="specialty">${esc(d.credentials)} · ${esc(d.experience)}</p>
        <p class="doctor-bio">${esc(d.bio)}</p>
        <div class="doctor-meta">
          <span>⌖ ${esc(d.clinic)} clinic</span>
          <span>◷ ${esc(d.hours.split('–')[0].trim())}</span>
          <span class="public-doctor-status">● ${esc(getDoctorStatus(d.id).status || 'Available')}</span>
        </div>
        <div class="flex flex-wrap gap-2 mt-4">
          <a class="small-action" href="doctor.html?doctor=${url(d.id)}">View profile ↗</a>
          <a class="btn-primary" href="booking.html?doctor=${url(d.id)}">Book with ${esc(d.name.split(' ')[1])} ↗</a>
        </div>
      </div>
    </article>`;

  /** Service card → services page */
  const serviceCard = s => `
    <article class="service-card">
      <div class="service-icon">${esc(s.icon)}</div>
      <h3>${esc(s.name)}</h3>
      <p>${esc(s.description)}</p>
      <div class="doctor-meta"><span>◷ ${esc(s.duration)}</span><span>From ${esc(s.from)}</span></div>
      <a href="booking.html?service=${url(s.name)}">Book this service ↗</a>
    </article>`;


  /* ===================================================================
     5. PAGES
     =================================================================== */

  /* ---- home: index.html ------------------------------------------------ */
  const initHome = () => {
    const host = $('featured-doctors');
    if (host) host.innerHTML = data.doctors.slice(0, 3).map(doctorCard).join('');
  };

  /* ---- services: services.html ----------------------------------------- */
  const initServices = () => {
    const host = $('all-services');
    if (host) host.innerHTML = data.services.map(serviceCard).join('');
  };

  /* ---- doctors: doctors.html  (search + specialty filter) -------------- */
  const initDoctors = () => {
    const host = $('doctor-directory');
    const search = $('doctor-search');
    const specialty = $('specialty-filter');
    if (!host) return;

    // Keep the filter in sync with data.js so newly added specialties, such
    // as Periodontics, are available without editing doctors.html as well.
    const specialties = [...new Set(data.doctors.map(d => d.specialty).filter(Boolean))].sort();
    specialties.forEach(value => {
      if (![...specialty.options].some(option => option.value === value)) {
        specialty.add(new Option(value, value));
      }
    });

    const render = () => {
      const query = search.value.toLowerCase();
      const list = data.doctors.filter(d =>
        (specialty.value === 'all' || d.specialty === specialty.value) &&
        `${d.name} ${d.specialty} ${d.clinic}`.toLowerCase().includes(query)
      );
      host.innerHTML = list.length
        ? list.map(doctorCard).join('')
        : '<p class="text-muted">No doctors match your search. Try another name or specialty.</p>';
    };

    search.addEventListener('input', render);
    specialty.addEventListener('change', render);
    render();
  };

  /* ---- doctor: doctor.html?doctor=ID ----------------------------------- */
  const initDoctorProfile = () => {
    const host = $('doctor-profile');
    if (!host) return;

    const d = findDoctor(params.get('doctor')) || data.doctors[0];   // unknown ID → first doctor
    if (!d) return;

    host.innerHTML = `
      <div class="doctor-profile-layout ">
        <img src="${esc(d.image)}" alt="Portrait of ${esc(d.name)}">
        <div class="profile-detail px-6 py-2">
          <p class="eyebrow">MEET YOUR DENTIST</p>
          <h1 class="section-title mt-3">${esc(d.name)}</h1>
          <p class="text-lg mt-3">${esc(d.credentials)} · ${esc(d.specialty)}</p>
          <p class="text-muted mt-5 leading-7">${esc(d.bio)} With ${esc(d.experience)} of experience, ${esc(d.name)} focuses on clear communication, comfortable visits, and treatment plans tailored to each patient.</p>
          ${detailGrid([
            ['Specialty', d.specialty],
            ['Experience', d.experience],
            ['Clinic', d.clinic],
            ['Working days', d.days],
            ['Hours', d.hours],
            ['Availability', d.availability]
          ])}
          <h2 class="text-h5 mt-7">Care approach</h2>
          <p class="text-muted mt-2 leading-7">${esc(d.bio)} Every visit starts with listening to your concerns and explaining available options before treatment begins.</p>
          <div class="flex flex-wrap gap-3 mt-7">
            <a class="btn-primary" href="booking.html?doctor=${url(d.id)}">Book an appointment ↗</a>
            <a class="small-action" href="doctor-dashboard.html?doctor=${url(d.id)}">Doctor dashboard preview ↗</a>
          </div>
        </div>
      </div>`;
  };

  /* ---- booking: booking.html -------------------------------------------
     Flow: doctor choose karo → service apne aap set ho jati hai.
     Service badalne se doctor kabhi reset nahi hota.
     ----------------------------------------------------------------------- */

  // Har specialty kaun si services de sakti hai (pehli service = automatic default)
  const SPECIALTY_SERVICES = {
    'General Dentistry':  ['General Dentistry', 'Family Dentistry', 'Restorative Dentistry', 'Emergency Visits'],
    'Cosmetic Dentistry': ['Cosmetic Dentistry'],
    'Orthodontics':       ['Orthodontics'],
    'Pediatric Dentistry': ['Family Dentistry'],
    'Endodontics':        ['Restorative Dentistry', 'Emergency Visits']
  };

  const initBooking = () => {
    const form = $('booking-form');
    if (!form) return;

    const serviceSelect = $('service');
    const doctorSelect = $('doctor');
    const dateInput = $('date');
    const timeInput = $('selected-time');       // hidden input, filled by the time-slot buttons
    const modal = $('confirmation-modal');

    const allServiceNames = data.services.map(s => s.name);
    const servicesForDoctor = doctor => doctor ? (SPECIALTY_SERVICES[doctor.specialty] || allServiceNames) : allServiceNames;

    // -- Service dropdown: only allowed services, keep the current one if still allowed
    const fillServices = (allowed, keep) => {
      serviceSelect.innerHTML = '<option value="">Select a service</option>';
      data.services
        .filter(s => allowed.includes(s.name))
        .forEach(s => serviceSelect.add(new Option(s.name, s.name)));
      serviceSelect.value = allowed.includes(keep) ? keep : '';
    };

    // -- Doctor changed → refresh services and auto-select the first valid one
    const syncServiceWithDoctor = () => {
      const doctor = findDoctor(doctorSelect.value);
      const allowed = servicesForDoctor(doctor);
      fillServices(allowed, serviceSelect.value);
      if (doctor && !serviceSelect.value) serviceSelect.value = allowed[0];
    };

    // -- Initial state (URL: ?doctor=dr-maya&service=General%20Dentistry)
    doctorSelect.innerHTML = '<option value="">Select a doctor</option>';
    data.doctors.forEach(d => {
      const option = new Option(`${d.name} — ${d.specialty} · ${d.clinic}`, d.id);
      if (emergencyIsActive(getDoctorStatus(d.id))) {
        option.disabled = true;
        option.textContent += ' · Emergency unavailable';
      }
      doctorSelect.add(option);
    });
    if (findDoctor(params.get('doctor'))) doctorSelect.value = params.get('doctor');
    fillServices(allServiceNames, params.get('service') || '');
    syncServiceWithDoctor();
    doctorSelect.addEventListener('change', () => { syncServiceWithDoctor(); updateBookingStatus(); });
    const bookingStatus = document.createElement('div');
    bookingStatus.className = 'notice-banner booking-status-notice mt-4';
    bookingStatus.hidden = true;
    doctorSelect.closest('.form-group')?.appendChild(bookingStatus);
    const updateBookingStatus = () => {
      const selectedDoctor = findDoctor(doctorSelect.value);
      const status = selectedDoctor && getDoctorStatus(selectedDoctor.id);
      if (selectedDoctor && emergencyIsActive(status)) {
        bookingStatus.hidden = false;
        bookingStatus.textContent = `🚨 ${selectedDoctor.name} is marked Emergency Away. Please choose another doctor.`;
        doctorSelect.value = '';
        syncServiceWithDoctor();
      } else if (selectedDoctor && status?.status && status.status !== 'Available') {
        bookingStatus.hidden = false;
        bookingStatus.textContent = `ℹ️ ${selectedDoctor.name} is currently ${status.status}. Please confirm your appointment time with reception.`;
      } else {
        bookingStatus.hidden = true;
      }
    };
    window.addEventListener('everwell:updated', updateBookingStatus);
    updateBookingStatus();

    // -- Date: past dates not allowed
    dateInput.min = todayISO();

    // -- Time slots: one selected at a time
    const slots = document.querySelectorAll('.time-slot');
    slots.forEach(button => button.addEventListener('click', () => {
      slots.forEach(b => b.classList.remove('selected'));
      button.classList.add('selected');
      timeInput.value = button.dataset.time;
    }));

    // -- Confirmation popup
    const closeModal = () => modal.classList.add('hidden');
    $('close-modal').addEventListener('click', closeModal);
    $('done-modal').addEventListener('click', closeModal);
    modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });   // click on backdrop

    const showConfirmation = (appointment, doctor) => {
      const rows = [
        ['Appointment ID', appointment.id],
        ['Patient', appointment.patient],
        ['Service', appointment.service],
        ['Doctor', doctor.name],
        ['Date', formatShortDate(appointment.date)],
        ['Time', appointment.time],
        ['Clinic', appointment.clinic],
        ['Status', 'Pending clinic review']
      ];
      $('confirmation-details').innerHTML = rows
        .map(([label, value]) => `<div><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`)
        .join('');
      modal.classList.remove('hidden');
    };

    // -- Submit: validate → save → notify admin → show popup
    form.addEventListener('submit', event => {
      event.preventDefault();

      if (!timeInput.value) {
        $('time-slots').scrollIntoView({ behavior: 'smooth', block: 'center' });
        alert('Please select an available demo time slot.');
        return;
      }

      const f = new FormData(form);
      const doctor = findDoctor(f.get('doctor'));
      if (!doctor) {
        alert('Please select a doctor for this service.');
        return;
      }
      if (emergencyIsActive(getDoctorStatus(doctor.id))) {
        alert(`${doctor.name} is currently unavailable due to an emergency. Please choose another doctor.`);
        return;
      }

      const id = `EW-${Math.random().toString(36).slice(2, 6).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const appointment = {
        id,
        patient: f.get('name'),
        email: f.get('email'),
        phone: f.get('phone'),
        doctor: doctor.name,
        doctorId: doctor.id,
        service: f.get('service'),
        date: f.get('date'),
        time: f.get('time'),
        clinic: f.get('clinic'),
        reason: f.get('reason'),
        notes: f.get('notes'),
        status: 'Pending review',
        queueStatus: 'waiting',
        notified: false,
        createdAt: new Date().toISOString()
      };

      const rows = readAppointments();
      rows.unshift(appointment);                        // newest first
      saveAppointments(rows);
      addDashboardNotification({
        doctorId: doctor.id,
        patient: appointment.patient,
        type: 'New online booking',
        message: `New patient ${appointment.patient} booked ${appointment.service} and is waiting in the queue.`
      });
      setAdminNotice(`New appointment request from ${appointment.patient} for ${doctor.name}. Please review booking ${id}.`, id);
      showConfirmation(appointment, doctor);
    });
  };

  /* ---- dashboard: dashboard.html (clinic / admin) ----------------------
     Filters, 5-per-page table, approve/reject, detail panel with
     previous/next, doctor links, date-wise schedule.
     ----------------------------------------------------------------------- */
  const initClinicDashboard = () => {
    const tableBody = $('dashboard-appointments');
    if (!tableBody) return;

    const PER_PAGE = 5;
    let pageNumber = 0;          // current table page (0-based)
    let selectedId = null;       // appointment open in the detail panel

    const filters = {
      doctor:  $('filter-doctor'),
      service: $('filter-service'),
      status:  $('filter-status')
    };
    data.doctors.forEach(d => filters.doctor.add(new Option(d.name, d.id)));
    data.services.forEach(s => filters.service.add(new Option(s.name, s.name)));

    // Appointments after applying the three filters
    const getFilteredRows = () => readAppointments().filter(a =>
      (filters.doctor.value  === 'all' || a.doctorId === filters.doctor.value) &&
      (filters.service.value === 'all' || a.service  === filters.service.value) &&
      (filters.status.value  === 'all' || a.status   === filters.status.value)
    );

    // Date-wise schedule panel (created below the table panel)
    const schedule = createSchedulePanel({
      after: tableBody.closest('.dashboard-panel'),
      title: 'Date-wise appointment schedule',
      subtitle: 'Review every clinic appointment grouped by appointment date.',
      idPrefix: 'clinic-schedule',
      showDoctor: true,
      getRows: () => readAppointments()
    });

    // Emergency queue: affected patients, reassignment, reschedule, refund and notification history.
    const emergencyPanel = document.createElement('section');
    emergencyPanel.className = 'dashboard-panel emergency-queue-panel mt-6';
    emergencyPanel.hidden = true;
    $('admin-notice')?.insertAdjacentElement('afterend', emergencyPanel);
    const getEmergencyGroups = () => {
      const statuses = getDoctorStatuses();
      return data.doctors.map(doctor => {
        const emergency = statuses[doctor.id];
        const affected = readAppointments().filter(a => a.doctorId === doctor.id && (a.emergencyAffected || affectedByEmergency(a, doctor.id, emergency)) && emergencyIsActive(emergency));
        return { doctor, emergency, affected };
      }).filter(group => group.affected.length);
    };
    const notificationHistoryHTML = () => {
      const notifications = getNotifications().slice(0, 8);
      return notifications.length ? `<div class="notification-history mt-5"><h3>Patient notification history</h3>${notifications.map(n => `<div class="notification-history-row"><span class="notification-icon">✓</span><div><strong>${esc(n.patient)} · ${esc(n.type)}</strong><small>${esc(n.channels.join(' / '))} · ${esc(n.delivery)}</small></div><time>${new Date(n.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time></div>`).join('')}</div>` : '';
    };
    const renderEmergencyQueue = () => {
      const groups = getEmergencyGroups();
      emergencyPanel.hidden = !groups.length;
      if (!groups.length) return;
      const groupHTML = group => {
        const appointmentHTML = group.affected.map(a => `
          <div class="emergency-appointment-row">
            <div><strong>${isUrgentAppointment(a) ? '⚠️ ' : ''}${esc(a.patient)}</strong><small>${esc(a.date || 'Date not set')} · ${esc(a.time)} · ${esc(a.service)}${isUrgentAppointment(a) ? ' · Urgent' : ''}</small></div>
            <div class="appointment-actions"><button class="small-action" data-emergency-action="reschedule" data-id="${esc(a.id)}" type="button">Send reschedule link</button><button class="small-action danger" data-emergency-action="cancel-refund" data-id="${esc(a.id)}" type="button">Cancel / refund</button></div>
          </div>`).join('');
        const doctorOptions = data.doctors.filter(d => d.id !== group.doctor.id && !emergencyIsActive(getDoctorStatus(d.id))).map(d => `<option value="${esc(d.id)}">${esc(d.name)}</option>`).join('');
        return `<div class="emergency-group"><div class="emergency-group-heading"><div><h3>${esc(group.doctor.name)}</h3><p>${esc(group.doctor.specialty)} · ${group.affected.length} affected appointment${group.affected.length === 1 ? '' : 's'}</p></div><div class="emergency-actions"><select class="field" data-reassign-select="${esc(group.doctor.id)}"><option value="">Reassign to…</option>${doctorOptions}</select><button class="small-action" data-emergency-action="reassign-all" data-doctor-id="${esc(group.doctor.id)}" type="button">Reassign all</button></div></div>${appointmentHTML}</div>`;
      };
      emergencyPanel.innerHTML = `<div class="panel-heading"><div><p class="eyebrow emergency-eyebrow">EMERGENCY QUEUE</p><h2>🚨 ${groups.reduce((count, group) => count + group.affected.length, 0)} appointments affected</h2><p>Patients have been notified through SMS, WhatsApp and email in this demo.</p></div><span class="status-pill emergency-status">Emergency Away</span></div>${groups.map(groupHTML).join('')}${notificationHistoryHTML()}`;
    };
    const emergencyAction = (action, id) => {
      const groups = getEmergencyGroups();
      const group = groups.find(x => x.affected.some(a => a.id === id));
      const appointment = readAppointments().find(a => a.id === id);
      if (!appointment) return;
      if (action === 'reschedule') {
        saveAppointments(readAppointments().map(a => a.id === id ? { ...a, status: 'Reschedule requested', emergencyStatus: 'Patient choosing new slot' } : a));
        addNotification({ appointmentId: id, patient: appointment.patient, channels: ['WhatsApp', 'Email'], type: 'Reschedule link', message: `Choose a new appointment time: demo-reschedule/${id}` });
      } else if (action === 'cancel-refund') {
        saveAppointments(readAppointments().map(a => a.id === id ? { ...a, status: 'Cancelled', paymentStatus: 'Refunded (demo)', emergencyStatus: 'Cancelled and refunded' } : a));
        addNotification({ appointmentId: id, patient: appointment.patient, channels: ['SMS', 'Email'], type: 'Cancellation and refund', message: 'Your appointment was cancelled and the demo refund was initiated.' });
      }
      setAdminNotice(`${appointment.patient}'s emergency appointment was updated: ${action === 'reschedule' ? 'reschedule link sent' : 'cancelled and refunded'}.`, id);
      renderEmergencyQueue();
      render();
      schedule.render();
    };
    emergencyPanel.addEventListener('click', event => {
      const button = event.target.closest('[data-emergency-action]');
      if (!button) return;
      const action = button.dataset.emergencyAction;
      if (action === 'reassign-all') {
        const select = emergencyPanel.querySelector(`[data-reassign-select="${button.dataset.doctorId}"]`);
        const substitute = findDoctor(select?.value);
        if (!substitute) { alert('Choose an alternate doctor first.'); return; }
        const group = getEmergencyGroups().find(x => x.doctor.id === button.dataset.doctorId);
        const ids = new Set(group?.affected.map(a => a.id));
        saveAppointments(readAppointments().map(a => ids.has(a.id) ? { ...a, doctorId: substitute.id, doctor: substitute.name, emergencyAffected: false, emergencyStatus: 'Reassigned' } : a));
        group?.affected.forEach(a => addNotification({ appointmentId: a.id, patient: a.patient, channels: ['SMS', 'WhatsApp', 'Email'], type: 'Doctor reassigned', message: `Your appointment has been reassigned to ${substitute.name}.` }));
        setAdminNotice(`${ids.size} appointment${ids.size === 1 ? '' : 's'} reassigned to ${substitute.name}.`, group?.affected[0]?.id);
        renderEmergencyQueue(); render(); schedule.render();
      } else emergencyAction(action, button.dataset.id);
    });
    window.addEventListener('everwell:updated', renderEmergencyQueue);
    window.addEventListener('storage', renderEmergencyQueue);
    renderEmergencyQueue();

    // -- Top cards + notice banner
    const updateMetrics = () => {
      const all = readAppointments();
      const pending = all.filter(isPending).length;
      $('metric-total').textContent = all.length;
      $('metric-doctors').textContent = data.doctors.length;
      $('metric-pending').textContent = pending;
      $('metric-confirmed').textContent = all.filter(a => a.status === 'Confirmed').length;
      $('pending-badge').textContent = `${pending} pending`;

      const notice = getAdminNotice();
      if (notice) {
        $('admin-notice').hidden = false;
        $('admin-notice').textContent = `🔔 Admin notification: ${notice.message}`;
      }
    };

    // -- Detail panel (one appointment, with previous / next)
    const renderDetail = id => {
      const rows = getFilteredRows();
      const a = rows.find(x => x.id === id) || rows[0];
      const panel = $('appointment-detail');
      if (!a) { panel.hidden = true; return; }

      selectedId = a.id;
      panel.hidden = false;
      $('detail-title').textContent = `${a.patient} · ${a.id}`;
      $('detail-subtitle').textContent = `${a.service} with ${a.doctor}`;
      $('detail-content').innerHTML = `
        ${detailGrid([
          ['Patient email', a.email],
          ['Phone', a.phone || 'Not provided'],
          ['Date and time', `${a.date || 'Date not set'} · ${a.time}`],
          ['Clinic', a.clinic || 'Everwell Dental'],
          ['Visit reason', a.reason || a.service],
          ['Status', a.status],
          ['Patient notes', a.notes || 'No additional notes']
        ])}
        <div class="flex flex-wrap gap-2 mt-5">
          <button class="small-action" data-detail-action="Confirmed" data-id="${esc(a.id)}">✓ Approve / confirm</button>
          <button class="small-action danger" data-detail-action="Rejected" data-id="${esc(a.id)}">Reject request</button>
          <a class="small-action" href="doctor-dashboard.html?doctor=${url(a.doctorId || '')}">Open doctor’s appointments ↗</a>
        </div>`;

      const index = rows.findIndex(x => x.id === a.id);
      $('detail-index').textContent = `Appointment ${index + 1} of ${rows.length}`;
      $('detail-prev').disabled = index <= 0;
      $('detail-next').disabled = index >= rows.length - 1;
    };

    // -- Table row actions
    const rowActions = a => `${isPending(a)
      ? `<button class="small-action" data-action="Confirmed" data-id="${esc(a.id)}">Approve</button>
         <button class="small-action danger" data-action="Rejected" data-id="${esc(a.id)}">Reject</button>`
      : `<button class="small-action" data-open-appointment="${esc(a.id)}">View</button>`}
      ${a.queueStatus === 'checked-in' ? '<span class="queue-state">✓ Checked in</span>' : `<button class="small-action" data-queue-action="check-in" data-id="${esc(a.id)}">Check in</button>`}`;

    const tableRow = a => `
      <tr>
        <td><button class="text-left" data-open-appointment="${esc(a.id)}"><strong>${isUrgentAppointment(a) ? '⚠️ ' : ''}${esc(a.patient)}</strong><small class="block text-muted">${esc(a.id)}${isUrgentAppointment(a) ? ' · Urgent' : ''}</small></button></td>
        <td>${esc(a.doctor)}</td>
        <td>${esc(a.date || '—')}<small class="block text-muted">${esc(a.time)}</small></td>
        <td>${esc(a.service)}</td>
        <td>${statusPill(a.status)}</td>
        <td><div class="appointment-actions">${rowActions(a)}</div></td>
      </tr>`;

    // -- Table + pagination
    const render = () => {
      const rows = getFilteredRows();
      const pageCount = Math.max(1, Math.ceil(rows.length / PER_PAGE));
      pageNumber = Math.min(pageNumber, pageCount - 1);
      const visible = rows.slice(pageNumber * PER_PAGE, (pageNumber + 1) * PER_PAGE);

      tableBody.innerHTML = visible.length
        ? visible.map(tableRow).join('')
        : '<tr><td colspan="6"><div class="empty-state">No appointments match these filters.</div></td></tr>';

      $('pagination-info').textContent = rows.length
        ? `Showing ${pageNumber * PER_PAGE + 1}–${Math.min((pageNumber + 1) * PER_PAGE, rows.length)} of ${rows.length} appointments`
        : 'No appointments';
      $('prev-page').disabled = pageNumber === 0;
      $('next-page').disabled = pageNumber + 1 >= pageCount;

      updateMetrics();
      if (selectedId && rows.some(a => a.id === selectedId)) renderDetail(selectedId);
    };

    // -- Approve / reject
    const changeStatus = (id, status) => {
      const rows = readAppointments().map(a => a.id === id ? { ...a, status } : a);
      saveAppointments(rows);
      const a = rows.find(x => x.id === id);
      setAdminNotice(`${a.patient}'s appointment ${id} was marked ${status}.`, id);
      if (status === 'Confirmed' && a) {
        addDashboardNotification({ doctorId: a.doctorId, patient: a.patient, type: 'Booking confirmed', message: `${a.patient}'s ${a.service} appointment is confirmed and waiting in the queue.` });
      }
      render();
      schedule.render();
    };

    const checkInPatient = id => {
      const appointment = readAppointments().find(a => a.id === id);
      if (!appointment) return;
      const updated = readAppointments().map(a => a.id === id ? { ...a, queueStatus: 'checked-in', notified: false } : a);
      saveAppointments(updated);
      addDashboardNotification({ doctorId: appointment.doctorId, patient: appointment.patient, type: 'Patient arrived', message: `Patient ${appointment.patient} has arrived at reception and is in the queue.` });
      setAdminNotice(`🏥 ${appointment.patient} checked in at reception and is waiting for ${appointment.doctor}.`, id);
      render();
      schedule.render();
    };

    // -- Events
    tableBody.addEventListener('click', e => {
      const action = e.target.closest('[data-action]');
      const queueAction = e.target.closest('[data-queue-action]');
      const open = e.target.closest('[data-open-appointment]');
      if (action) changeStatus(action.dataset.id, action.dataset.action);
      else if (queueAction) checkInPatient(queueAction.dataset.id);
      else if (open) renderDetail(open.dataset.openAppointment);
    });

    $('detail-content').addEventListener('click', e => {
      const button = e.target.closest('[data-detail-action]');
      if (button) changeStatus(button.dataset.id, button.dataset.detailAction);
    });

    Object.values(filters).forEach(select => select.addEventListener('change', () => {
      pageNumber = 0;
      render();
    }));

    $('prev-page').addEventListener('click', () => { pageNumber = Math.max(0, pageNumber - 1); render(); });
    $('next-page').addEventListener('click', () => { pageNumber++; render(); });

    $('close-detail').addEventListener('click', () => {
      $('appointment-detail').hidden = true;
      selectedId = null;
    });

    const stepDetail = offset => {
      const rows = getFilteredRows();
      const next = rows[rows.findIndex(a => a.id === selectedId) + offset];
      if (next) renderDetail(next.id);
    };
    $('detail-prev').addEventListener('click', () => stepDetail(-1));
    $('detail-next').addEventListener('click', () => stepDetail(+1));

    // -- Right-hand list: every doctor + how many appointments they have
    const doctorLinks = $('availability-list');
    if (doctorLinks) {
      const all = readAppointments();
      doctorLinks.innerHTML = data.doctors.map(d => `
        <a class="doctor-list-link" href="doctor-dashboard.html?doctor=${url(d.id)}">
          <span><strong>${esc(d.name)}</strong><small class="block text-muted">${esc(d.specialty)} · ${esc(getDoctorStatus(d.id).status || 'Available')} · ${all.filter(a => a.doctorId === d.id).length} appointment(s)</small></span>
          <b>Open ↗</b>
        </a>`).join('');
    }

    window.addEventListener('storage', schedule.render);   // another tab changed the data
    render();
  };

  /* ---- doctor-dashboard: doctor-dashboard.html?doctor=ID ----------------
     Selected doctor ki appointments, ek waqt mein ek, previous / next ke saath.
     ----------------------------------------------------------------------- */
  const initDoctorDashboard = () => {
    const select = $('doctor-dashboard-select');
    const list = $('doctor-dashboard-appointments');
    if (!select || !list) return;

    let current = 0;   // index of the appointment being shown

    data.doctors.forEach(d => select.add(new Option(`${d.name} — ${d.specialty}`, d.id)));
    if (findDoctor(params.get('doctor'))) select.value = params.get('doctor');

    const getDoctorRows = () => readAppointments().filter(a => a.doctorId === select.value);

    const renderProfile = () => {
      const d = findDoctor(select.value);
      const host = $('doctor-dashboard-profile');
      if (!host || !d) return;
      const todayRows = getDoctorRows().filter(a => a.date === todayISO());
      const arrivedToday = todayRows.filter(a => a.queueStatus === 'checked-in' || a.queueStatus === 'called').length;
      const cancelledToday = todayRows.filter(a => a.status === 'Cancelled' || a.status === 'Rejected').length;
      host.innerHTML = `
        <div class="flex items-center gap-4">
          <img src="${esc(d.image)}" alt="" style="width:76px;height:76px;object-fit:cover;border-radius:16px">
          <div>
            <h3 class="text-h5">${esc(d.name)}</h3>
            <p class="text-muted">${esc(d.credentials)} · ${esc(d.specialty)} · ${esc(d.experience)}</p>
            <p class="text-muted">${esc(d.clinic)} clinic · ${esc(d.days)} · ${esc(d.hours)}</p>
            <a class="text-link" href="doctor.html?doctor=${url(d.id)}">Open full profile ↗</a>
            <div class="doctor-today-report mt-5"><div><small>Today’s patients</small><strong>${todayRows.length}</strong></div><div><small>Arrived / seen</small><strong>${arrivedToday}</strong></div><div><small>Cancelled</small><strong>${cancelledToday}</strong></div><div><small>Waiting</small><strong>${todayRows.filter(a => a.queueStatus !== 'called' && a.status !== 'Cancelled' && a.status !== 'Rejected').length}</strong></div></div>
            <div class="emergency-controls mt-5">
              <div class="status-control-row"><label class="text-sm font-semibold">Live status<select id="doctor-live-status" class="field mt-2"><option>Available</option><option>In Consultation</option><option>On Break</option><option>Emergency Away</option></select></label><span id="doctor-status-label" class="status-pill">Available</span></div>
              <div id="emergency-form" class="emergency-form mt-4" hidden>
                <label class="text-sm font-semibold">Unavailable for<select id="emergency-duration" class="field mt-2"><option value="2-hours">Next 2 hours</option><option value="whole-day">Whole day</option><option value="specific-date">Specific date</option></select></label>
                <label id="emergency-date-wrap" class="text-sm font-semibold" hidden>Unavailable date<input id="emergency-date" class="field mt-2" type="date" min="${todayISO()}"></label>
                <label class="text-sm font-semibold">Alternate doctor<select id="emergency-substitute" class="field mt-2"><option value="">No substitute</option>${data.doctors.filter(x=>x.id!==d.id && !emergencyIsActive(getDoctorStatus(x.id))).map(x=>`<option value="${esc(x.id)}">${esc(x.name)}</option>`).join('')}</select></label>
                <button id="confirm-emergency" class="small-action danger mt-3" type="button">Mark unavailable & notify patients</button>
              </div>
            </div>
          </div>
        </div>`;
      const currentStatus = getDoctorStatus(d.id);
      const statusSelect = $('doctor-live-status');
      const statusLabel = $('doctor-status-label');
      const emergencyForm = $('emergency-form');
      const durationSelect = $('emergency-duration');
      const dateWrap = $('emergency-date-wrap');
      const emergencyDate = $('emergency-date');
      const syncEmergencyUI = () => {
        const status = statusSelect.value;
        statusLabel.textContent = status;
        statusLabel.className = `status-pill ${status === 'Emergency Away' ? 'emergency-status' : ''}`;
        emergencyForm.hidden = status !== 'Emergency Away';
        dateWrap.hidden = durationSelect.value !== 'specific-date';
      };
      statusSelect.value = currentStatus.status || 'Available';
      if (currentStatus.duration) durationSelect.value = currentStatus.duration;
      if (currentStatus.date) emergencyDate.value = currentStatus.date;
      syncEmergencyUI();
      statusSelect.addEventListener('change', () => {
        if (statusSelect.value !== 'Emergency Away') {
          const nextStatus = { status: statusSelect.value, updatedAt: new Date().toISOString() };
          setDoctorStatus(d.id, nextStatus);
          addDashboardNotification({ audience: 'clinic', doctorId: d.id, type: 'Doctor status changed', message: `${d.name} is now ${nextStatus.status}.` });
          syncEmergencyUI();
          return;
        }
        syncEmergencyUI();
      });
      durationSelect.addEventListener('change', syncEmergencyUI);
      $('confirm-emergency').addEventListener('click', () => {
        if (durationSelect.value === 'specific-date' && !emergencyDate.value) {
          alert('Please choose the date for the emergency leave.');
          return;
        }
        const duration = durationSelect.value;
        const until = duration === '2-hours'
          ? new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
          : duration === 'whole-day'
            ? new Date(`${todayISO()}T23:59:59`).toISOString()
            : new Date(`${emergencyDate.value}T23:59:59`).toISOString();
        const emergency = { status: 'Emergency Away', duration, date: emergencyDate.value || todayISO(), until, substituteId: $('emergency-substitute').value, updatedAt: new Date().toISOString() };
        const affected = readAppointments().filter(a => affectedByEmergency(a, d.id, emergency));
        saveAppointments(readAppointments().map(a => affected.some(x => x.id === a.id) ? { ...a, emergencyAffected: true, emergencyDoctorId: d.id, emergencyStatus: 'Awaiting action' } : a));
        setDoctorStatus(d.id, emergency);
        addDashboardNotification({ audience: 'clinic', doctorId: d.id, type: 'Doctor status changed', message: `🚨 ${d.name} is now Emergency Away. ${affected.length} appointment${affected.length === 1 ? '' : 's'} may be affected.` });
        notifyAffectedPatients(d, affected, emergency);
        setAdminNotice(`🚨 ${affected.length} appointment${affected.length === 1 ? '' : 's'} affected by ${d.name}'s emergency.`, affected[0]?.id);
        alert(`${d.name} is now unavailable. ${affected.length} patient notification${affected.length === 1 ? '' : 's'} recorded as delivered (demo).`);
        render();
      });
    };

    const render = () => {
      renderProfile();
      const rows = getDoctorRows();

      if (!rows.length) {
        list.innerHTML = '<div class="empty-state">No appointments are assigned to this doctor yet. Book an appointment with the matching specialty or choose another doctor above.</div>';
        return;
      }

      current = Math.min(current, rows.length - 1);
      const a = rows[current];

      list.innerHTML = `
        <article class="appointment-card">
          <div class="appointment-card-head">
            <div>
              <p class="eyebrow">${esc(a.id)}</p>
              <h3 class="text-h5 mt-2">${esc(a.patient)}</h3>
              <p class="text-muted mt-1">${esc(a.service)} · ${esc(a.date || 'Date not set')} · ${esc(a.time)}</p>
            </div>
            ${statusPill(a.status)}
          </div>
          ${detailGrid([
            ['Email', a.email],
            ['Phone', a.phone || 'Not provided'],
            ['Clinic', a.clinic || 'Everwell Dental'],
            ['Notes', a.notes || 'No additional notes']
          ])}
          <details class="appointment-edit mt-5">
            <summary>Change patient appointment</summary>
            <form class="appointment-edit-form mt-4" data-edit-appointment="${esc(a.id)}">
              <label>Date<input class="field mt-2" name="date" type="date" value="${esc(a.date || todayISO())}" min="${todayISO()}" required></label>
              <label>Time<input class="field mt-2" name="time" value="${esc(a.time || '')}" required></label>
              <label>Status<select class="field mt-2" name="status"><option ${a.status === 'Confirmed' ? 'selected' : ''}>Confirmed</option><option ${a.status === 'Pending review' ? 'selected' : ''}>Pending review</option><option ${a.status === 'Reschedule requested' ? 'selected' : ''}>Reschedule requested</option><option ${a.status === 'Cancelled' ? 'selected' : ''}>Cancelled</option></select></label>
              <button class="small-action mt-4" type="submit">Save appointment change</button>
            </form>
          </details>
        </article>
        <div class="pager">
          <button id="doctor-prev" type="button" class="small-action" ${current === 0 ? 'disabled' : ''}>← Previous</button>
          <span class="text-sm text-muted">Appointment ${current + 1} of ${rows.length}</span>
          <button id="doctor-next" type="button" class="small-action" ${current === rows.length - 1 ? 'disabled' : ''}>Next →</button>
        </div>`;

      // The buttons are re-created on every render, so connect them here
      $('doctor-prev').addEventListener('click', () => { current = Math.max(0, current - 1); render(); });
      $('doctor-next').addEventListener('click', () => { current = Math.min(rows.length - 1, current + 1); render(); });
    };

    list.addEventListener('submit', event => {
      const form = event.target.closest('[data-edit-appointment]');
      if (!form) return;
      event.preventDefault();
      const appointment = readAppointments().find(a => a.id === form.dataset.editAppointment);
      if (!appointment) return;
      const values = new FormData(form);
      const updated = { ...appointment, date: values.get('date'), time: values.get('time'), status: values.get('status'), queueStatus: values.get('status') === 'Cancelled' ? 'called' : appointment.queueStatus };
      saveAppointments(readAppointments().map(a => a.id === updated.id ? updated : a));
      notifyPatient(updated, 'Appointment updated', `Your appointment with ${updated.doctor} was updated to ${updated.date} at ${updated.time}.`, ['SMS', 'WhatsApp', 'Email']);
      addDashboardNotification({ audience: 'clinic', doctorId: updated.doctorId, patient: updated.patient, type: 'Appointment updated', message: `${updated.patient}'s appointment was changed to ${updated.date} at ${updated.time}.` });
      setAdminNotice(`${updated.patient}'s appointment was updated by ${updated.doctor}.`, updated.id);
      render();
      renderQueue();
      schedule.render();
    });

    // Date-wise schedule for the selected doctor
    const schedule = createSchedulePanel({
      after: list.parentElement,
      title: 'Date-wise doctor schedule',
      subtitle: 'Appointments for the selected doctor, grouped by date.',
      idPrefix: 'doctor-schedule',
      showDoctor: false,
      getRows: getDoctorRows
    });

    // Live patient queue for the selected doctor.
    const queuePanel = document.createElement('section');
    queuePanel.className = 'dashboard-panel patient-queue-panel mt-6';
    list.parentElement.insertAdjacentElement('afterend', queuePanel);
    const renderQueue = () => {
      const queue = getDoctorRows().filter(a => a.queueStatus !== 'called');
      queuePanel.innerHTML = `<div class="panel-heading"><div><p class="eyebrow">PATIENT QUEUE</p><h2>Patients waiting <span class="queue-count">${queue.length}</span></h2><p>Call the next patient to send an SMS / WhatsApp alert.</p></div><span class="status-pill queue-live">● Live</span></div>${queue.length ? `<div class="patient-queue-list">${queue.map((a, index) => `<div class="patient-queue-row"><div><strong>${index === 0 ? 'Next · ' : ''}${isUrgentAppointment(a) ? '⚠️ ' : ''}${esc(a.patient)}</strong><small>${esc(a.service)} · ${esc(a.time)} · ${queueLabel(a)}${isUrgentAppointment(a) ? ' · Urgent' : ''}</small></div><button class="small-action" data-call-patient="${esc(a.id)}" type="button">Call patient</button></div>`).join('')}</div>` : '<div class="empty-state">No patients are currently waiting in this queue.</div>'}`;
    };
    queuePanel.addEventListener('click', event => {
      const button = event.target.closest('[data-call-patient]');
      if (!button) return;
      const appointment = readAppointments().find(a => a.id === button.dataset.callPatient);
      const doctor = findDoctor(select.value);
      if (!appointment || !doctor) return;
      saveAppointments(readAppointments().map(a => a.id === appointment.id ? { ...a, queueStatus: 'called', notified: true } : a));
      notifyPatient(appointment, 'Patient called', `Dr. ${doctor.name.replace(/^Dr\.\s*/, '')} is ready for you. Please proceed to the treatment room.`, ['SMS', 'WhatsApp']);
      addDashboardNotification({ doctorId: doctor.id, patient: appointment.patient, type: 'Patient called', message: `${appointment.patient} was called from the queue.` });
      renderQueue();
      render();
      schedule.render();
    });
    window.addEventListener('everwell:notification', renderQueue);
    window.addEventListener('storage', renderQueue);
    renderQueue();

    select.addEventListener('change', () => {
      current = 0;
      render();
      schedule.render();
      renderQueue();
    });
    window.addEventListener('storage', schedule.render);
    render();
  };


  /* ===================================================================
     6. DATE-WISE SCHEDULE PANEL  (clinic dashboard + doctor dashboard)
     Appointments ko date ke hisaab se group karta hai, optional date filter ke saath.
     =================================================================== */

  /** HTML for rows grouped by date. showDoctor = also print the doctor's name. */
  const groupedScheduleHTML = (rows, showDoctor) => {
    const byDate = rows.slice().sort(byDateTime).reduce((groups, a) => {
      (groups[a.date || ''] ||= []).push(a);
      return groups;
    }, {});

    const html = Object.entries(byDate).map(([date, items]) => `
      <section class="date-schedule-group">
        <div class="date-schedule-heading">
          <h3>${esc(formatLongDate(date))}</h3>
          <span>${items.length} appointment${items.length === 1 ? '' : 's'}</span>
        </div>
        <div class="date-schedule-list">
          ${items.map(a => `
            <div class="date-schedule-row">
              <div>
                <strong>${esc(a.time || 'Time not set')} · ${esc(a.patient)}</strong>
                <small>${esc(a.service)}${showDoctor ? ` · ${esc(a.doctor)}` : ''}</small>
              </div>
              ${statusPill(a.status)}
            </div>`).join('')}
        </div>
      </section>`).join('');

    return html || '<div class="empty-state">No appointments match this date.</div>';
  };

  /** Builds the panel, inserts it after `after`, returns { render }. */
  function createSchedulePanel({ after, title, subtitle, idPrefix, showDoctor, getRows }) {
    const panel = document.createElement('section');
    panel.className = 'dashboard-panel date-schedule-panel mt-6';
    panel.innerHTML = `
      <div class="panel-heading"><div><h2>${title}</h2><p>${subtitle}</p></div></div>
      <div class="filter-row">
        <label class="text-sm font-semibold">Appointment date<input id="${idPrefix}-date" class="field mt-2" type="date"></label>
        <button id="${idPrefix}-clear" class="small-action filter-clear" type="button">All dates</button>
      </div>
      <div id="${idPrefix}-list" class="mt-5"></div>`;
    after.insertAdjacentElement('afterend', panel);

    const dateInput = $(`${idPrefix}-date`);
    const clearButton = $(`${idPrefix}-clear`);
    const listHost = $(`${idPrefix}-list`);

    const render = () => {
      const selected = dateInput.value;
      listHost.innerHTML = groupedScheduleHTML(getRows().filter(a => !selected || a.date === selected), showDoctor);
    };

    dateInput.addEventListener('change', render);
    clearButton.addEventListener('click', () => { dateInput.value = ''; render(); });
    render();

    return { render };
  }


  /* ===================================================================
     7. START
     Header/footer har page par; baaki sirf current page (data-page) ka init.
     =================================================================== */

  const PAGE_INIT = {
    'home':             initHome,
    'services':         initServices,
    'doctors':          initDoctors,
    'doctor':           initDoctorProfile,
    'booking':          initBooking,
    'dashboard':        initClinicDashboard,
    'doctor-dashboard': initDoctorDashboard
  };

  renderHeader();
  renderFooter();
  (PAGE_INIT[page] || (() => {}))();
})();
