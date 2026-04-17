# 📄 Technical Documentation

## *Comprehensive Attack Path Analysis & Visualization Framework for Active Directory*

---

## 1. Executive Summary

This project is a sophisticated security orchestration and visualization platform designed to identify, analyze, and neutralize relationship-based attack vectors within **Active Directory (AD)** environments. By transforming raw SharpHound data into a high-fidelity directed graph, enables security analysts to visualize complex privilege escalation chains, compute stealthy attack paths, and identify critical network choke points.

The system bridges the gap between raw data collection and actionable offensive/defensive intelligence, providing a real-time environment for simulating breach scenarios and assessing the total "Blast Radius" of compromised identities.

---

## 2. System Architecture

The application follows a modern **decoupled monolith** architecture utilizing a Flask-based RESTful API and a high-performance Vanilla JavaScript frontend.

### 2.1 Backend Engine (Python Development Stack)

- **Framework**: Flask (Web Server Gateway Interface)
- **Graph Mathematics**: **NetworkX** (Directed Graph Theory Library)
- **State Management**: JSON-based persistent storage for node status (Loot, Notes, Compromise status).
- **Core Logic**: `graph_logic.py` - Handles the abstraction of AD relationships into mathematical edges with difficulty weights.

### 2.2 Frontend Visualization (Modern Web UI)

- **Rendering Engine**: **Cytoscape.js** (Canvas-based graph rendering)
- **Layout Management**: **Dagre** (Directed Acyclic Graph REnderer for hierarchical layering)
- **UI Framework**: Vanilla JS with a custom CSS design system optimized for dark-mode "SOC" (Security Operations Center) aesthetics.
- **Interactions**: Asynchronous Fetch API for non-blocking data synchronization.

---

## 3. Core Graph Logic & Informatics

### 3.1 Data Ingestion Model

This utilizes the **SharpHound (BloodHound)** data schema. It parses multi-stage JSON outputs, specifically looking for:

- **Objects**: Users, Groups, Computers, GPOs, OUs, and Domains.
- **Access Control Entries (ACEs)**: Relationship mappings such as `GenericAll`, `WriteDacl`, `AdminTo`, etc.
- **Membership**: Group nesting and session data.

The graph construction logic (`build_graph`) standardizes all identifiers to uppercase for case-insensitive matching and ensures graph integrity by handling missing principal nodes automatically.

### 3.2 The Exploit Difficulty Weight Model (EDWM)

Unlike standard BFS tools,This uses a weighted model to differentiate between "Noisy/Difficult" exploits and "Silent/Easy" privilege inheritance.

| Relationship Type | Weight | Rationale |
| :--- | :--- | :--- |
| **MemberOf** | 0.1 | Transparent inheritance; zero detection risk. |
| **AdminTo** | 1.0 | Requires execution (PsExec/WMI), low-medium risk. |
| **GenericAll** | 2.0 | Total object control; multiple vectors possible. |
| **Kerberoastable** | 5.0 | Offline cracking; detectable via honeytoken SPNs. |
| **DCSync** | 10.0 | Extremely high-value/noisy; indicative of full domain compromise. |
| **WriteDacl** | 3.0 | Structural change; requires careful ACL manipulation. |

### 3.3 Algorithms

1. **Fastest Path (BFS)**: Optimizes for the minimum number of "hops" (nodes) between source and target.
2. **Stealthiest Path (Dijkstra)**: Minimizes the total cumulative weight, or "Path of Least Resistance."
3. **Choke Point Detection (Betweenness Centrality)**: Identifies nodes that appear most frequently on shortest paths. High centrality nodes (Score > 0.05) are flagged as critical bottlenecks for remediation.

---

## 4. Feature Deep Dive

### 4.1 Real-Time Session Persistence

The system maintains a `state.json` file that persists across server restarts. It tracks:

- **Owned Nodes**: Red-highlighted nodes representing an established foothold.
- **Loot Capture**: Captured hashes, passwords, or tickets stored per node.
- **Investigation Notes**: Analytical observations for post-operation reports.

### 4.2 Automated Attack Playbooks

When a path is calculated, the system dynamically generates a **Command Playbook**. It maps graph edges to specific CLI tools like:

- `psexec.py` (Impacket)
- `Rubeus.exe`
- `mimikatz.exe`
- `certipy-ad` (for ADCS paths)

### 4.3 Impact Analysis (Blast Radius)

Using a directed Breath-First Search (BFS) traversal, the "Impact Analysis" feature calculates the total reachability of a node. It answers the critical question: *"If this account is compromised, exactly how many other objects can be reached?"*

---

## 5. API Reference

### 5.1 Graph endpoints

- `GET /api/graph`: Returns the complete serialized graph for Cytoscape.
- `GET /api/summary`: Returns statistical breakdown (Admins, Users, Computers).
- `GET /api/files`: Lists available JSON datasets.

### 5.2 Pathfinding

- `POST /api/path/shortest`:
  - **Body**: `{ "source": "node_id", "target": "node_id" }`
  - **Support**: Sending `"source": "OWNED"` triggers multi-source Dijkstra from all compromised nodes.

### 5.3 State Management

- `POST /api/mark_owned`: Mark a node as compromised.
- `POST /api/update_node_details`: Update loot/notes for a specific node.

---

## 6. Project Structure

```text
AD-Project/
├── app.py                # Main Flask Application & API Routes
├── graph_logic.py        # Graph construction & Pathfinding logic
├── debug_graph.py        # CLI Utility for logic verification
├── data/
│   ├── state.json        # Persistent user session data
│   └── *.json            # SharpHound datasets (Tesla, TechCorp, etc.)
├── static/
│   ├── css/
│   │   └── style.css     # Design System (Glassmorphism & Dark Mode)
│   └── js/
│   │   └── main.js       # Cytoscape management & UI Logic
└── templates/
    └── index.html        # Main Application SPA Shell
```

---

## 7. Setup & Deployment

1. **Install Dependencies**:

    ```bash
    pip install flask networkx
    ```

2. **Run Server**:

    ```bash
    python app.py
    ```

3. **Access UI**: Navigate to `http://127.0.0.1:5000`

---

## 8. Future Roadmap

- **Graph Differing**: Visualize changes between two network snapshots.
- **Automated Remediation**: Generate Group Policy Objects (GPOs) to prune high-risk paths.
- **Neo4j Connector**: Direct integration with professional-grade graph databases for larger (>50k node) environments.
- **AI Triage**: ML-based classification of "Likeliness of Exploitation" based on actual network traffic logs.

---
**Document Version**: 2.1.0  
**Internal Project**: Operational Security Analytics  
**Classification**: CONFIDENTIAL / RED TEAM USE ONLY
