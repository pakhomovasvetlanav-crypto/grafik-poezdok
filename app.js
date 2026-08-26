(() => {
  "use strict";

  const statusLabels = {
    planned: "запланирована",
    in_progress: "в пути",
    completed: "выполнена"
  };

  const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (symbol) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  }[symbol]));

  const toMinutes = (time) => {
    const [hours, minutes] = time.split(":").map(Number);
    return hours * 60 + minutes;
  };

  const driverDot = (driver) => `<span class="driver-dot ${driver.color === "violet" ? "purple" : ""}"></span>`;
  const driverTag = (driver) => `<div class="driver-tag">${driverDot(driver)}${escapeHtml(driver.name)}</div>`;
  const rideLabel = (ride) => `${escapeHtml(ride.title)} · ${escapeHtml(ride.route)}`;

  function renderRideRow(ride, driver, icon = "↗") {
    return `<div class="ride-row ${driver.color === "violet" ? "mirlan" : ""}">
      <div class="ride-icon">${icon}</div>
      <div><div class="ride-name">${rideLabel(ride)}</div><div class="ride-meta">${ride.start}–${ride.end} · ${escapeHtml(ride.details || statusLabels[ride.status])}</div></div>
      ${driverTag(driver)}
    </div>`;
  }

  function renderDashboard(data) {
    const drivers = Object.fromEntries(data.drivers.map((driver) => [driver.id, driver]));
    const now = new Date();
    const dashboardDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const rides = data.rides.filter((ride) => ride.date === dashboardDate);
    const active = rides.filter((ride) => ride.status === "in_progress");
    const upcoming = rides.filter((ride) => ride.status === "planned").sort((a, b) => a.start.localeCompare(b.start));
    const next = upcoming[0];
    const activeList = document.getElementById("activeList");
    const plannedList = document.getElementById("plannedList");
    const historyGrid = document.getElementById("historyGrid");

    if (activeList) {
      activeList.innerHTML = active.length
        ? active.map((ride) => renderRideRow(ride, drivers[ride.driverId])).join("")
        : `<p class="text-small">Сейчас нет активных поездок.</p>`;
    }
    document.querySelector(".badge.live").textContent = `● ${active.length} активн${active.length === 1 ? "ая" : "ые"}`;

    const nextPanel = document.getElementById("nextRidePanel");
    if (nextPanel) {
      const content = nextPanel.querySelector(".panel-inner");
      content.innerHTML = `<div class="panel-head"><div><div class="eyebrow">Ближайший выезд</div><h2>Следующая поездка</h2></div><span class="badge next">${next ? next.start : "нет поездок"}</span></div>
        ${next ? renderRideRow(next, drivers[next.driverId], "◷") : `<p class="text-small">Запланированных поездок нет.</p>`}
        <div class="actions" style="margin-top:16px"><button class="button secondary" onclick="switchView('planner')">Открыть план</button><button class="button" onclick="showToast('Для изменения поездки сообщите сотруднику EGGHEADS.')">Изменить через EGGHEADS</button></div>`;
    }

    if (plannedList) plannedList.innerHTML = rides.sort((a, b) => a.start.localeCompare(b.start)).map((ride) => renderRideRow(ride, drivers[ride.driverId], ride.status === "completed" ? "✓" : ride.status === "planned" ? "◷" : "↗")).join("");
    if (historyGrid) {
      historyGrid.innerHTML = rides.sort((a, b) => a.start.localeCompare(b.start)).map((ride) => `<div class="history-item"><span class="time">${ride.start}–${ride.end}</span><strong>${escapeHtml(ride.title)}</strong><span class="driver-line">${driverDot(drivers[ride.driverId])}${escapeHtml(drivers[ride.driverId].name)} · ${statusLabels[ride.status]}</span></div>`).join("");
    }

    renderTimeline(rides, drivers);
    renderTasks(data.tasks, dashboardDate, drivers);
  }

  function renderTimeline(rides, drivers) {
    const content = document.getElementById("timelineContent");
    if (!content) return;
    const rideMinutes = rides.flatMap((ride) => [toMinutes(ride.start), toMinutes(ride.end)]);
    const rawStart = rideMinutes.length ? Math.min(...rideMinutes) : 8 * 60;
    const rawEnd = rideMinutes.length ? Math.max(...rideMinutes) : 16 * 60;
    const dayStart = Math.floor(Math.max(0, rawStart - 30) / 60) * 60;
    const dayEnd = Math.ceil(Math.min(24 * 60, rawEnd + 30) / 60) * 60;
    const span = dayEnd - dayStart;
    const overlaps = [];
    rides.forEach((ride, index) => rides.slice(index + 1).forEach((other) => {
      if (ride.driverId === other.driverId) return;
      const start = Math.max(toMinutes(ride.start), toMinutes(other.start));
      const end = Math.min(toMinutes(ride.end), toMinutes(other.end));
      if (start < end) overlaps.push({ start, end });
    }));
    const hours = Array.from({ length: Math.max(1, Math.round((dayEnd - dayStart) / 60)) }, (_, index) => `<span>${String(Math.floor(dayStart / 60) + index).padStart(2, "0")}:00</span>`).join("");
    const lanes = Object.values(drivers).map((driver) => {
      const blocks = rides.filter((ride) => ride.driverId === driver.id).map((ride) => {
        const left = Math.max(0, ((toMinutes(ride.start) - dayStart) / span) * 100);
        const width = Math.min(100 - left, ((toMinutes(ride.end) - toMinutes(ride.start)) / span) * 100);
        return `<div class="ride-block ${driver.color === "violet" ? "mirlan-block" : "alex-block"}" style="left:${left}%;width:${width}%">${escapeHtml(ride.title)}</div>`;
      }).join("");
      const bands = overlaps.map((overlap) => `<i class="overlap-band" style="left:${((overlap.start - dayStart) / span) * 100}%;width:${((overlap.end - overlap.start) / span) * 100}%"></i>`).join("");
      return `<div class="driver-lane"><div class="lane-label">${driverDot(driver)}${escapeHtml(driver.name)}</div><div class="lane">${bands}${blocks}</div></div>`;
    }).join("");
    const overlapText = overlaps.length ? `Пересечение: с ${String(Math.floor(overlaps[0].start / 60)).padStart(2, "0")}:${String(overlaps[0].start % 60).padStart(2, "0")} до ${String(Math.floor(overlaps[0].end / 60)).padStart(2, "0")}:${String(overlaps[0].end % 60).padStart(2, "0")} оба водителя одновременно в поездках.` : "Пересечений в графике нет.";
    content.innerHTML = `<div class="timeline"><div class="time-scale"><span></span>${hours}</div>${lanes}</div><div class="overlap-note"><span class="overlap-mark"></span><span><strong>${escapeHtml(overlapText)}</strong></span></div>`;
  }

  function renderTasks(tasks, date, drivers) {
    Object.values(drivers).forEach((driver) => {
      const driverTasks = tasks.filter((task) => task.driverId === driver.id && task.date === date);
      const completed = driverTasks.filter((task) => task.completed).length;
      const target = document.getElementById(driver.id === "alexander" ? "alexTasks" : "mirlanTasks");
      if (target) target.innerHTML = driverTasks.map((task) => `<div class="task-card"><input class="check" type="checkbox" ${task.completed ? "checked" : ""} disabled aria-label="${task.completed ? "Задача выполнена" : "Задача ожидает выполнения"}"><div><div class="task-name">${escapeHtml(task.title)}</div><div class="task-meta">до ${task.due} · ${task.completed ? "выполнено" : "в работе"}</div></div></div>`).join("");
      const card = target?.closest(".task-driver");
      const counter = card?.querySelector(".task-driver-head .text-small");
      if (counter) counter.textContent = `${completed} из ${driverTasks.length} выполнено`;
    });
  }

  document.addEventListener("submit", (event) => {
    if (!["rideForm", "taskForm"].includes(event.target.id)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    window.showToast?.("Передайте изменения сотруднику EGGHEADS — он обновит общий реестр и дашборд.");
  }, true);

  fetch(`data.json?updated=${Date.now()}`, { cache: "no-store" })
    .then((response) => response.ok ? response.json() : Promise.reject(new Error("Данные недоступны")))
    .then(renderDashboard)
    .catch(() => window.showToast?.("Показаны последние опубликованные данные."));
})();
