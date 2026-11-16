/**
 * 220 Lab · Film Script Lab — Waitlist Approval & Invite Console (scripts/admin.js)
 */
(function () {
  "use strict";

  const CFG = window.SCRIPTLAB_CONFIG || {};
  const API_BASE = String(CFG.WORKER_URL || "").replace(/\/$/, "");
  const KEY_STORAGE = "scriptlab-admin-key-session";

  const loginCard = document.getElementById("admin-login-card");
  const dash = document.getElementById("admin-dashboard");
  let adminKey = sessionStorage.getItem(KEY_STORAGE) || "";

  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
    ));
  }

  async function apiAdmin(path, method = "GET", body = null) {
    const opts = {
      method,
      headers: {
        Authorization: `Bearer ${adminKey}`,
        "Content-Type": "application/json",
      },
    };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(`${API_BASE}${path}`, opts);
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  }

  async function loadWaitlist() {
    const { ok, status, data } = await apiAdmin("/api/admin/waitlist");
    if (!ok) {
      if (status === 401) {
        sessionStorage.removeItem(KEY_STORAGE);
        adminKey = "";
        loginCard.hidden = false;
        dash.hidden = true;
      }
      return false;
    }

    loginCard.hidden = true;
    dash.hidden = false;

    document.getElementById("st-total").textContent = String(data.counts?.total || 0);
    document.getElementById("st-pending").textContent = String(data.counts?.pending || 0);
    document.getElementById("st-approved").textContent = String(data.counts?.approved || 0);
    document.getElementById("st-invites").textContent = String((data.invites || []).length);

    const tbody = document.getElementById("admin-tbody");
    const recs = data.records || [];
    if (!recs.length) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text-2);padding:28px;">No waitlist applications yet.</td></tr>`;
      return true;
    }

    const siteBase = (CFG.SITE_URL || "https://scriptlab.cloud").replace(/\/$/, "");

    tbody.innerHTML = recs
      .map((r) => {
        const st = r.status || "pending";
        const magic =
          r.access_code
            ? `${siteBase}/app.html?email=${encodeURIComponent(r.email)}&code=${encodeURIComponent(r.access_code)}`
            : "";
        const mailSubj = encodeURIComponent("You're Approved — 220 Lab · Film Script Lab");
        const mailBody = encodeURIComponent(
          `Hi ${r.name || "there"},\n\nYour access to 220 Lab · Film Script Lab (scriptlab.cloud) has been approved.\n\n1-Click Studio Launch:\n${magic || siteBase + "/app.html"}\n\nAccess Code: ${r.access_code || "(use your email)"}\n\n— Zhan Petrov\n220 Lab`
        );

        return `
          <tr>
            <td style="font-family:var(--mono);font-size:12px;">#${esc(r.queue_number || "-")}</td>
            <td>
              <strong>${esc(r.name || "-")}</strong><br />
              <code style="font-size:12px;">${esc(r.email)}</code>
            </td>
            <td>
              ${esc(r.role || "-")}<br />
              <span style="font-size:12px;color:var(--text-2);">Plan: ${esc(r.plan_interest || r.tier || "beta")}</span>
            </td>
            <td style="max-width:280px;font-size:13px;">
              ${r.youtube_url ? `<a href="${esc(r.youtube_url)}" target="_blank" rel="noopener">YouTube Source ↗</a><br />` : ""}
              <span style="color:var(--text-2);">${esc(r.notes || "")}</span>
            </td>
            <td>
              <span class="pill-status ${esc(st)}">${esc(st)}</span>
              ${r.access_code ? `<div style="font-family:var(--mono);font-size:11px;margin-top:4px;">${esc(r.access_code)}</div>` : ""}
            </td>
            <td>
              <div style="display:flex;gap:6px;flex-wrap:wrap;">
                ${
                  st !== "approved"
                    ? `<button type="button" class="btn-pill primary sm" data-adm-approve="${esc(r.email)}">Approve</button>`
                    : `<button type="button" class="btn-pill secondary sm" data-copy-link="${esc(magic)}">Copy Link</button>
                       <a class="btn-pill secondary sm" href="mailto:${esc(r.email)}?subject=${mailSubj}&body=${mailBody}">Email Invite</a>`
                }
                ${
                  st !== "rejected" && st !== "approved"
                    ? `<button type="button" class="btn-pill secondary sm" data-adm-reject="${esc(r.email)}">Hold</button>`
                    : ""
                }
              </div>
            </td>
          </tr>
        `;
      })
      .join("");

    return true;
  }

  document.getElementById("admin-login-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = document.getElementById("admin-login-err");
    err.hidden = true;
    adminKey = document.getElementById("admin-key-input")?.value.trim() || "";
    const ok = await loadWaitlist();
    if (ok) {
      sessionStorage.setItem(KEY_STORAGE, adminKey);
    } else {
      err.hidden = false;
      err.textContent = "Invalid SCRIPTLAB_ADMIN_KEY.";
    }
  });

  document.getElementById("admin-refresh-btn")?.addEventListener("click", () => loadWaitlist());
  document.getElementById("admin-logout-btn")?.addEventListener("click", () => {
    sessionStorage.removeItem(KEY_STORAGE);
    adminKey = "";
    dash.hidden = true;
    loginCard.hidden = false;
  });

  document.getElementById("direct-approve-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const out = document.getElementById("dir-approve-out");
    const email = document.getElementById("dir-email")?.value.trim() || "";
    const tier = document.getElementById("dir-tier")?.value || "beta";
    const { ok, data } = await apiAdmin("/api/admin/approve", "POST", { email, tier });
    if (ok && data.ok) {
      out.hidden = false;
      out.innerHTML = `<strong>Approved:</strong> <code>${esc(data.record.access_code)}</code><br /><a href="${esc(data.magic_link)}" target="_blank">${esc(data.magic_link)}</a>`;
      loadWaitlist();
    }
  });

  document.getElementById("mint-invite-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const out = document.getElementById("mint-invite-out");
    const code = document.getElementById("inv-code")?.value.trim() || "";
    const maxUses = Number(document.getElementById("inv-uses")?.value || 25);
    const { ok, data } = await apiAdmin("/api/admin/invite/create", "POST", { code, max_uses: maxUses, tier: "beta" });
    if (ok && data.ok) {
      out.hidden = false;
      out.innerHTML = `<strong>Minted <code>${esc(data.invite.code)}</code> (${data.invite.max_uses} uses):</strong><br /><a href="${esc(data.invite_url)}" target="_blank">${esc(data.invite_url)}</a>`;
      loadWaitlist();
    }
  });

  document.getElementById("admin-tbody")?.addEventListener("click", async (e) => {
    const appBtn = e.target.closest("[data-adm-approve]");
    if (appBtn) {
      await apiAdmin("/api/admin/approve", "POST", { email: appBtn.dataset.admApprove, tier: "beta" });
      loadWaitlist();
      return;
    }
    const rejBtn = e.target.closest("[data-adm-reject]");
    if (rejBtn) {
      await apiAdmin("/api/admin/reject", "POST", { email: rejBtn.dataset.admReject });
      loadWaitlist();
      return;
    }
    const copyBtn = e.target.closest("[data-copy-link]");
    if (copyBtn) {
      await navigator.clipboard.writeText(copyBtn.dataset.copyLink || "");
      const old = copyBtn.textContent;
      copyBtn.textContent = "Copied ✓";
      setTimeout(() => (copyBtn.textContent = old), 1400);
    }
  });

  if (adminKey) loadWaitlist();
})();
