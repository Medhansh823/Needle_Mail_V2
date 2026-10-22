const app = document.querySelector('#app');
const title = document.querySelector('#title');
const approvalCount = document.querySelector('#approvalCount');

// Simple XSS sanitization for email content
function sanitizeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// CSRF token helper - in production, this would be fetched from a meta tag
function getCSRFToken() {
    // Try to get from meta tag, fallback to empty string
    const meta = document.querySelector('meta[name="csrf-token"]');
    return meta ? meta.getAttribute("content") || "" : "";
}

const views = {
    inbox: async function () {
        try {
            const res = await fetch('/api/inbox', {
                headers: {
                    'Authorization': localStorage.getItem('auth_token') || '',
                    'X-CSRF-Token': getCSRFToken()
                }
            });
            const emails = await res.json();
            title.textContent = 'Inbox';
            app.innerHTML = '<div class="grid">' +
                '<div class="card"><div class="metric">' + emails.length + '</div><div class="muted">Messages analyzed</div></div>' +
                '<div class="card"><div class="metric">' + emails.filter(function (e) { return e.priority === 'urgent'; }).length + '</div><div class="muted">Urgent</div></div>' +
                '<div class="card"><div class="metric">' + emails.filter(function (e) { return e.category === 'customer' || e.category === 'support'; }).length + '</div><div class="muted">Customer/support</div></div>' +
                '<div class="card"><div class="metric">94%</div><div class="muted">AI confidence</div></div>' +
                '</div><div class="list">' + emails.map(function (m) {
                    return '<div class="mail" data-email-id="' + m.id + '">' +
                        '<div><div class="sender">' + sanitizeHtml(m.sender) + '</div><span class="pill ' + m.priority + '">' + m.priority + '</span></div>' +
                        '<div><div class="subject">' + sanitizeHtml(m.subject) + '</div><div class="preview">' + sanitizeHtml(m.preview || '') + '</div><div>' + (m.labels || []).map(function (x) { return '<span class="pill">' + x + '</span>'; }).join('') + '</div>' +
                        '<div class="priority muted">' + m.category + '</div>' +
                        '</div>';
                }).join('') + '</div>';

            // Add click handlers for email detail
            var _this = this;
            document.querySelectorAll('.mail').forEach(function (el) {
                el.onclick = function () { showEmailDetail(m.id); };
            });
        } catch (err) {
            app.innerHTML = '<p class="error">Failed to load inbox: ' + err.message + '</p>';
        }
    },

    emailDetail: async function (emailId) {
        try {
            const res = await fetch('/api/email/' + emailId, {
                headers: {
                    'Authorization': localStorage.getItem('auth_token') || '',
                    'X-CSRF-Token': getCSRFToken()
                }
            });
            const email = await res.json();
            title.textContent = email.subject;
            app.innerHTML = '<div class="email-detail">' +
                '<div class="email-header">' +
                '<div class="sender">' + sanitizeHtml(email.sender) + '</div>' +
                '<div class="subject-line">' + sanitizeHtml(email.subject) + '</div>' +
                '<div class="date muted">' + new Date(email.receivedAt).toLocaleString() + '</div>' +
                '</div>' +
                '<div class="email-body">' + sanitizeHtml(email.body) + '</div>' +
                '<div class="email-actions">' +
                '<button class="btn reply" data-email-id="' + email.id + '">Reply</button>' +
                '<button class="btn forward" data-email-id="' + email.id + '">Forward</button>' +
                '<button class="btn draft" data-email-id="' + email.id + '">Draft Reply</button>' +
                '</div>' +
                '<div class="ai-summary" style="margin-top: 20px; padding: 16px; background: #f6f7f9; border-radius: 8px;">' +
                '<strong>AI Summary:</strong> <span class="summary-text">Analyzing email content...</span>' +
                '</div>' +
                '</div>';

            // Add event listeners
            document.querySelectorAll('.reply').forEach(function (btn) {
                btn.onclick = function () { showReplyCompose(btn.dataset.emailId); };
            });
            document.querySelectorAll('.forward').forEach(function (btn) {
                btn.onclick = function () { showForwardCompose(btn.dataset.emailId); };
            });
            document.querySelectorAll('.draft').forEach(function (btn) {
                btn.onclick = function () { showDraftCompose(btn.dataset.emailId); };
            });
        } catch (err) {
            app.innerHTML = '<p class="error">Failed to load email detail: ' + err.message + '</p>';
        }
    },

    replyCompose: async function (emailId) {
        try {
            const res = await fetch('/api/email/' + emailId, {
                headers: {
                    'Authorization': localStorage.getItem('auth_token') || '',
                    'X-CSRF-Token': getCSRFToken()
                }
            });
            const email = await res.json();
            title.textContent = 'Reply: ' + email.subject;
            app.innerHTML = '<div class="compose-window">' +
                '<div class="compose-header">' +
                '<span>Replying to: ' + sanitizeHtml(email.sender) + '</span>' +
                '<span class="close" data-view="inbox">← Back</span>' +
                '</div>' +
                '<div class="compose-form">' +
                '<div class="form-row">' +
                '<span>To:</span> <span>' + sanitizeHtml(email.sender) + '</span>' +
                '</div>' +
                '<div class="form-row">' +
                '<span>Subject:</span> <span>Re: ' + sanitizeHtml(email.subject) + '</span>' +
                '</div>' +
                '<textarea id="replyBody" rows="8" cols="50" placeholder="Write your reply here...">' + sanitizeHtml(email.body ? email.body.substring(0, 200) : '') + '...</textarea>' +
                '<div style="margin-top: 16px;">' +
                '<button class="btn-send" data-email-id="' + emailId + '">Send Reply</button>' +
                '<button class="btn-cancel" data-view="inbox">Cancel</button>' +
                '</div>' +
                '</div>' +
                '</div>';

            document.querySelector('.btn-send').onclick = async function () {
                var body = document.querySelector('#replyBody').value;
                var sendRes = await fetch('/api/reply', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-Token': getCSRFToken()
                    },
                    body: JSON.stringify({ emailId: emailId, body: body })
                });
                var result = await sendRes.json();
                if (result.success) {
                    alert('Reply sent!');
                    views.inbox();
                } else {
                    alert('Failed to send: ' + (result.error || 'unknown error'));
                }
            };

            document.querySelector('.btn-cancel').onclick = function () {
                if (confirm('Are you sure you want to cancel?')) {
                    views.inbox();
                }
            };
        } catch (err) {
            app.innerHTML = '<p class="error">Failed to open reply composer: ' + err.message + '</p>';
        }
    },

    draftCompose: async function (emailId) {
        try {
            const res = await fetch('/api/email/' + emailId, {
                headers: {
                    'Authorization': localStorage.getItem('auth_token') || '',
                    'X-CSRF-Token': getCSRFToken()
                }
            });
            const email = await res.json();
            title.textContent = 'Draft Reply: ' + email.subject;
            app.innerHTML = '<div class="compose-window">' +
                '<div class="compose-header">' +
                '<span>Drafting reply to: ' + sanitizeHtml(email.sender) + '</span>' +
                '<span class="close" data-view="inbox">← Back</span>' +
                '</div>' +
                '<div class="compose-form">' +
                '<div class="form-row">' +
                '<span>To:</span> <span>' + sanitizeHtml(email.sender) + '</span>' +
                '</div>' +
                '<div class="form-row">' +
                '<span>Subject:</span> <span>Re: ' + sanitizeHtml(email.subject) + '</span>' +
                '</div>' +
                '<textarea id="draftBody" rows="8" cols="50" placeholder="Write your draft here..."></textarea>' +
                '<div style="margin-top: 16px;">' +
                '<button class="btn-save-draft" data-email-id="' + emailId + '">Save Draft</button>' +
                '<button class="btn-cancel" data-view="inbox">Cancel</button>' +
                '</div>' +
                '</div>' +
                '</div>';

            document.querySelector('.btn-save-draft').onclick = async function () {
                var body = document.querySelector('#draftBody').value;
                var saveRes = await fetch('/api/draft', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-Token': getCSRFToken()
                    },
                    body: JSON.stringify({ emailId: emailId, body: body })
                });
                var result = await saveRes.json();
                if (result.success) {
                    alert('Draft saved!');
                    views.inbox();
                } else {
                    alert('Failed to save: ' + (result.error || 'unknown error'));
                }
            };

            document.querySelector('.btn-cancel').onclick = function () {
                if (confirm('Are you sure you want to cancel?')) {
                    views.inbox();
                }
            };
        } catch (err) {
            app.innerHTML = '<p class="error">Failed to open draft composer: ' + err.message + '</p>';
        }
    },

    approvals: async function () {
        try {
            const res = await fetch('/api/approvals', {
                headers: {
                    'Authorization': localStorage.getItem('auth_token') || '',
                    'X-CSRF-Token': getCSRFToken()
                }
            });
            const approvals = await res.json();
            title.textContent = 'Approvals';
            approvalCount.textContent = approvals.length;
            app.innerHTML = '<div class="panel">' +
                '<h2>Actions waiting for you</h2>' +
                approvals.map(function (a) {
                    return '<div class="row">' +
                        '<div><b>' + sanitizeHtml(a.proposal.action) + ': ' + sanitizeHtml(a.reason) + '</div>' +
                        '<div class="muted">' + a.confidence + '% confidence • ' + new Date(a.createdAt).toLocaleTimeString() + '</div>' +
                        '</div>' +
                        '<div class="row">' +
                        '<div style="display: flex; gap: 8px;">' +
                        '<button class="toggle approve" data-approval-id="' + a.id + '">Approve</button>' +
                        '<button class="toggle reject" data-approval-id="' + a.id + '">Reject</button>' +
                        '</div>' +
                        '</div>';
                }).join('') +
                '</div>';

            // Add event listeners for approval decisions
            document.querySelectorAll('.approve').forEach(function (btn) {
                btn.onclick = async function () {
                    var approvalId = btn.dataset.approvalId;
                    var result = await fetch('/api/approval/' + approvalId + '/decide', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-CSRF-Token': getCSRFToken()
                        },
                        body: JSON.stringify({ decision: 'approved' })
                    });
                    var data = await result.json();
                    if (data.success) {
                        alert('Approved!');
                        views.approvals();
                    }
                };
            });

            document.querySelectorAll('.reject').forEach(function (btn) {
                btn.onclick = async function () {
                    var approvalId = btn.dataset.approvalId;
                    var result = await fetch('/api/approval/' + approvalId + '/decide', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-CSRF-Token': getCSRFToken()
                        },
                        body: JSON.stringify({ decision: 'rejected' })
                    });
                    var data = await result.json();
                    if (data.success) {
                        alert('Rejected!');
                        views.approvals();
                    }
                };
            });
        } catch (err) {
            app.innerHTML = '<p class="error">Failed to load approvals: ' + err.message + '</p>';
        }
    },

    rules: async function () {
        try {
            const res = await fetch('/api/rules', {
                headers: {
                    'Authorization': localStorage.getItem('auth_token') || '',
                    'X-CSRF-Token': getCSRFToken()
                }
            });
            const rules = await res.json();
            title.textContent = 'Automation';
            app.innerHTML = '<div class="panel">' +
                '<h2>Automation rules</h2>' +
                rules.map(function (r) {
                    return '<div class="row">' +
                        '<div><b>' + sanitizeHtml(r.name) + '</b></div>' +
                        '<div class="muted">' + (r.enabled ? 'Enabled' : 'Disabled') + '</div>' +
                        '</div>' +
                        '<div class="row">' +
                        '<div><b>Conditions:</b> ' + JSON.stringify(r.conditions).substring(0, 80) + '...</div>' +
                        '</div>' +
                        '<div class="row">' +
                        '<div><b>Actions:</b> ' + (r.actions.length > 0 ? r.actions.map(function (a) { return a.action; }).join(', ') : 'None') + '</div>' +
                        '</div>' +
                        '<div class="row" style="justify-content: flex-end;">' +
                        '<button class="toggle">' + (r.enabled ? 'Disable' : 'Enable') + '</button>' +
                        '</div>';
                }).join('') +
                '</div>';
        } catch (err) {
            app.innerHTML = '<p class="error">Failed to load rules: ' + err.message + '</p>';
        }
    },

    permissions: async function () {
        try {
            const res = await fetch('/api/permissions', {
                headers: {
                    'Authorization': localStorage.getItem('auth_token') || '',
                    'X-CSRF-Token': getCSRFToken()
                }
            });
            const permissions = await res.json();
            title.textContent = 'Permissions';
            app.innerHTML = '<div class="panel">' +
                '<h2>What Needle can do automatically</h2>' +
                permissions.map(function (p) {
                    return '<div class="row">' +
                        '<div><b>' + sanitizeHtml(p.action) + '</b><div class="muted">Permission applies before every action.</div></div>' +
                        '<button class="toggle">' + p.mode + ' ▾</button>' +
                        '</div>';
                }).join('') +
                '</div>';
        } catch (err) {
            app.innerHTML = '<p class="error">Failed to load permissions: ' + err.message + '</p>';
        }
    },

    audit: async function () {
        try {
            const res = await fetch('/api/audit?limit=50', {
                headers: {
                    'Authorization': localStorage.getItem('auth_token') || '',
                    'X-CSRF-Token': getCSRFToken()
                }
            });
            const events = await res.json();
            title.textContent = 'Audit log';
            app.innerHTML = '<div class="panel">' +
                '<h2>Recent activity</h2>' +
                events.map(function (e) {
                    return '<div class="row">' +
                        '<div>' + new Date(e.occurredAt).toLocaleTimeString() + ' — ' + sanitizeHtml(e.action) + ' — ' + sanitizeHtml(e.outcome) + '</div>' +
                        '<span class="pill">Logged</span>' +
                        '</div>';
                }).join('') +
                '</div>';
        } catch (err) {
            app.innerHTML = '<p class="error">Failed to load audit log: ' + err.message + '</p>';
        }
    }
};

document.querySelectorAll('nav button').forEach(function (b) {
    b.onclick = function () {
        document.querySelectorAll('nav button').forEach(function (x) { x.classList.remove('active'); });
        b.classList.add('active');
        var view = b.dataset.view;
        if (views[view]) {
            views[view]();
        }
    }
});

// Initialize with inbox
views.inbox();
