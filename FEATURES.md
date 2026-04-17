# ⚔️ Previon Features Documentation

Previon is a high-performance Active Directory attack path visualizer and pentesting assistant designed for operationally-focused Red Team engagements.

## 1. 🔍 Attack Graph Visualization

* **Comprehensive Mapping**: Visualizes AD objects including Users, Computers, Groups, Domains, OUs, GPOs, and Certificate Authorities.
* **Modern Rendition**: High-contrast, beautifully styled node icons (FontAwesome) with color-coded security status.
* **Technical Identifiers**: Real-time display of OS versions, IP addresses, and Service Principal Names (SPN).
* **💎 High-Value Tagging**: Automatic identification and gold-glow highlighting for Domain Admins, Domain Controllers, and Enterprise Admins.

## 2. 🛣️ Advanced Pathfinding

* **Fastest Route (Hops)**: Traditional BFS-based pathfinding to find the quickest way to Domain Admin with the fewest steps.
* **Stealthiest Path (Difficulty Weights)**: Dijkstra-based algorithm using a unique **Exploitation Weight Model**. It prioritizes stealthier techniques (like privilege inheritance) over noisy ones (like DCSync).
* **Multi-Source Attack**: Simulate an attack starting from *all* compromised nodes simultaneously to find the easiest target in the environment.

## 3. 🛡️ GPO & ADCS Integration

* **GPO Mapping**: Visualizes Group Policy links (`GPLink`) and abuse vectors (`EditGPO`, `EditSettings`).
* **ADCS Attack Surface**: Identification of Certificate Authorities and vulnerable certificate templates (ESC attacks).

## 4. ☢️ Operational Capabilities

* **Impact Analysis**: One-click assessment from any node to see exactly how many nodes and privileged targets can be compromised from that foothold.
* **Chokepoint Detection**: Sophisticated betweenness centrality analysis to identify and highlight the "bottlenecks" that appear in most attack paths.

## 5. 📒 Offensive Intelligence System

* **Loot Capture**: Dedicated storage for captured hashes, cleartext passwords, and API keys directly on each node.
* **Investigation Notes**: Persistent note-taking for every object.
* **Privilege Summary**: Consolidated view of Local Admin rights, Delegation status, and Active Sessions for every selected object.
* **Bookmarks & History**: Star important nodes for quick recall and track your search investigation history.

## 6. 📊 Environment Summary Dashboard

* **Live Metrics**: Permanent top-bar dashboard showing:
  * **Total Users & Computers** in the environment.
  * **Privileged Account Count** for instant risk assessment.
  * **Kerberoastable accounts detecton** based on current graph data.

## 7. 💾 Local State Persistence

* **Persistent Sessions**: Every compromise, note, bookmark, and piece of loot is saved locally in `data/state.json`.
* **Session Continuity**: Restart the tool without losing your progress on the engagement.

## 8. 🎨 Premium Glassmorphism UI

* **Aesthetic Innovation**: Translucent "Glass" sidebar and panels with real-time backdrop blurring.
* **Technical Typography**: Roboto Mono and Inter fonts for a sharp, cybersecurity-first look.

---
*Created for Active Directory Pentesting Professionals.*
