from flask import Flask, render_template, jsonify, request
import networkx as nx
import json
import os
from graph_logic import build_graph, calculate_shortest_path, calculate_easiest_path, calculate_paths_from_owned, calculate_centrality

app = Flask(__name__)

# Global Store
G = nx.DiGraph()
OWNED_NODES = set()
LOOT = {}   # node_id -> string
NOTES = {}  # node_id -> string
CENTRALITY_CACHE = {}
CHOKE_THRESHOLD = 0.05
STATE_FILE = "data/state.json"
CURRENT_FILE = "sample_data.json"
if os.path.exists("data/sample_data.json"):
    CURRENT_FILE = "sample_data.json"

if not os.path.exists("data"):
    os.makedirs("data")

def save_state():
    state = {
        "owned": list(OWNED_NODES),
        "loot": LOOT,
        "notes": NOTES,
    }
    try:
        with open(STATE_FILE, "w") as f:
            json.dump(state, f)
    except Exception as e:
        print(f"Error saving state: {e}")

def load_state():
    global OWNED_NODES, LOOT, NOTES
    if os.path.exists(STATE_FILE):
        try:
            with open(STATE_FILE, "r") as f:
                state = json.load(f)
                OWNED_NODES = set(state.get("owned", []))
                LOOT = state.get("loot", {})
                NOTES = state.get("notes", {})
        except Exception as e:
            print(f"Error loading state: {e}")

def load_data(filename=None):
    global G, CENTRALITY_CACHE, CURRENT_FILE
    try:
        if filename:
            data_path = os.path.join("data", filename)
            if not os.path.exists(data_path):
                 # Fallback check in root
                 if os.path.exists(filename):
                     data_path = filename
                 else:
                     print(f"File {filename} not found.")
                     return False
            CURRENT_FILE = filename
        else:
             # Default behavior
             data_path = "sample_data.json"
             if os.path.exists("data/sample_data.json"):
                  data_path = "data/sample_data.json"
                  CURRENT_FILE = "sample_data.json"
        
        if os.path.exists(data_path):
            print(f"Loading data from {data_path}...")
            with open(data_path, "r") as f:
                raw_data = json.load(f)
            G = build_graph(raw_data)
            print(f"Graph loaded: {G.number_of_nodes()} nodes, {G.number_of_edges()} edges.")
            
            # Pre-calculate centrality for optimization
            # In a real heavy app, this should be a background job
            print("Calculating centrality (choke points)...")
            CENTRALITY_CACHE = calculate_centrality(G)
            print("Centrality calculation complete.")
            
            # Load user persistence (loot, owned, etc)
            load_state()
            return True
        else:
            print("No data found.")
            return False
    except Exception as e:
        print(f"Error loading data: {e}")

# Initial Load
load_data()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/graph')
def get_graph():
    elements = []
    
    for node, data in G.nodes(data=True):
        is_owned = node in OWNED_NODES
        score = CENTRALITY_CACHE.get(node, 0)
        is_choke = score >= CHOKE_THRESHOLD

        # Automated High-Value Tagging
        is_high_value = data.get("highvalue", False)
        node_upper = node.upper()
        
        # Check for critical keywords
        critical_names = ["DOMAIN ADMINS", "ENTERPRISE ADMINS", "ADMINISTRATOR", "DC01", "DC02", "DOMAIN CONTROLLER"]
        if any(crit in node_upper for crit in critical_names):
            is_high_value = True
        
        if data.get("type") == "CertificateAuthority":
            is_high_value = True

        # Determine specific subtype for computers
        subtype = "Generic"
        if data.get("type") == "Computer":
            if is_high_value or "DC" in node_upper:
                subtype = "DC"
            elif "WS" in node_upper or "WORKSTATION" in node_upper:
                subtype = "Workstation"

        elements.append({
            "data": {
                "id": node,
                "label": data.get("label", node),
                "type": data.get("type", "Unknown"),
                "subtype": subtype,
                "owned": "true" if is_owned else "false",
                "choke": "true" if is_choke else "false",
                "centrality": score,
                "highvalue": "true" if is_high_value else "false",
                "has_loot": "true" if node in LOOT else "false",
                "has_notes": "true" if node in NOTES else "false",
                "ipaddress": data.get("ipaddress", ""),
                "operatingsystem": data.get("operatingsystem", ""),
                "local_admin": data.get("local_admin", False),
                "delegation": data.get("delegation", ""),
                "sessions": data.get("sessions", 0)
            }
        })
    
    for u, v, data in G.edges(data=True):
        elements.append({
            "data": {
                "source": u,
                "target": v,
                "relationship": data.get("relationship", "Unknown"),
                "weight": data.get("weight", 0),
                "technique": data.get("technique", "Unknown")
            }
        })
        
    return jsonify(elements)

def find_node(search_term):
    if not search_term:
        return None
    search_upper = search_term.upper()
    
    # 1. Direct ID match
    for node in G.nodes():
        if node.upper() == search_upper:
            return node
            
    # 2. Search in data (label, ipaddress)
    for node, data in G.nodes(data=True):
        if data.get('label', '').upper() == search_upper:
            return node
        if data.get('ipaddress', '') == search_term:
            return node
            
    return None

@app.route('/api/path/shortest', methods=['POST'])
def get_shortest_path():
    req = request.json
    source_input = req.get('source', '')
    target_input = req.get('target', '')
    
    if not source_input or not target_input:
        return jsonify({"error": "Missing source or target"}), 400
    
    target = find_node(target_input)
    if not target:
         return jsonify({"error": f"Target node '{target_input}' not found in graph"}), 404

    if source_input.upper() == "OWNED":
        best_path = None
        min_hops = float('inf')
        
        for src in OWNED_NODES:
            if not G.has_node(src): continue
            path = calculate_shortest_path(G, src, target)
            if path and len(path) < min_hops:
                min_hops = len(path)
                best_path = path
        
        if not best_path:
             return jsonify({"found": False})
        return jsonify({"found": True, "path": best_path})

    source = find_node(source_input)
    if not source:
         return jsonify({"error": f"Source node '{source_input}' not found in graph"}), 404

    path = calculate_shortest_path(G, source, target)
    if not path:
        return jsonify({"found": False})
        
    return jsonify({"found": True, "path": path})

@app.route('/api/path/easiest', methods=['POST'])
def get_easiest_path():
    req = request.json
    source_input = req.get('source', '')
    target_input = req.get('target', '')

    if not source_input or not target_input:
        return jsonify({"error": "Missing source or target"}), 400

    target = find_node(target_input)
    if not target:
         return jsonify({"error": f"Target node '{target_input}' not found in graph"}), 404

    if source_input.upper() == "OWNED":
         if not OWNED_NODES:
             return jsonify({"error": "No owned nodes defined"}), 400
         path, cost = calculate_paths_from_owned(G, list(OWNED_NODES), target)
         if not path:
              return jsonify({"found": False})
         return jsonify({"found": True, "path": path, "cost": cost})

    source = find_node(source_input)
    if not source:
         return jsonify({"error": f"Source node '{source_input}' not found in graph"}), 404

    path = calculate_easiest_path(G, source, target)
    if not path:
         return jsonify({"found": False})
    
    cost = nx.dijkstra_path_length(G, source, target, weight="weight")
    return jsonify({"found": True, "path": path, "cost": cost})


@app.route('/api/mark_owned', methods=['POST'])
def mark_owned():
    global OWNED_NODES
    req = request.json
    node = req.get('node')
    
    if node and G.has_node(node):
        OWNED_NODES.add(node)
        save_state()
        return jsonify({"status": "success", "owned_nodes": list(OWNED_NODES)})
    
    return jsonify({"error": "Invalid node"}), 400

@app.route('/api/update_node_details', methods=['POST'])
def update_node_details():
    req = request.json
    node = req.get('node')
    loot = req.get('loot')
    notes = req.get('notes')
    
    if not node or not G.has_node(node):
        return jsonify({"error": "Invalid node"}), 400
    
    if loot is not None:
        if loot.strip():
            LOOT[node] = loot
        else:
            LOOT.pop(node, None)
            
    if notes is not None:
        if notes.strip():
            NOTES[node] = notes
        else:
            NOTES.pop(node, None)
            
    save_state()
    return jsonify({"status": "success"})

@app.route('/api/get_node_details/<node_id>')
def get_node_details(node_id):
    if not G.has_node(node_id):
        return jsonify({"error": "Node not found"}), 404
    
    return jsonify({
        "loot": LOOT.get(node_id, ""),
        "notes": NOTES.get(node_id, "")
    })

@app.route('/api/summary')
def get_summary():
    users = [n for n, d in G.nodes(data=True) if d.get('type') == 'User']
    computers = [n for n, d in G.nodes(data=True) if d.get('type') == 'Computer']
    groups = [n for n, d in G.nodes(data=True) if d.get('type') == 'Group']
    gpos = [n for n, d in G.nodes(data=True) if d.get('type') == 'GPO']
    
    # Identify Admins (Priority Targets)
    admins = []
    for node, data in G.nodes(data=True):
        if data.get("highvalue") or "ADMIN" in node.upper() or "TIER 0" in node.upper():
            admins.append(node)

    return jsonify({
        "total_users": len(users),
        "users_list": users[:15],
        "total_computers": len(computers),
        "computers_list": computers[:15],
        "total_groups": len(groups),
        "groups_list": groups[:15],
        "total_gpos": len(gpos),
        "gpos_list": gpos[:15],
        "total_admins": len(admins),
        "admins_list": admins[:15]
    })

@app.route('/api/unmark_owned', methods=['POST'])
def unmark_owned():
    global OWNED_NODES
    req = request.json
    node = req.get('node')
    
    if node and node in OWNED_NODES:
        OWNED_NODES.remove(node)
        save_state()
        return jsonify({"status": "success", "owned_nodes": list(OWNED_NODES)})
    
    return jsonify({"error": "Node not in owned list"}), 400

@app.route('/api/reset_owned', methods=['POST'])
def reset_owned():
    global OWNED_NODES, LOOT, NOTES
    OWNED_NODES = set()
    LOOT = {}
    NOTES = {}
    save_state()
    return jsonify({"status": "cleared"})

@app.route('/api/files', methods=['GET'])
def list_files():
    files = []
    # List files in data directory
    if os.path.exists("data"):
         for f in os.listdir("data"):
             if f.endswith(".json") and f != "state.json":
                 files.append(f)
    
    # Also check root for sample
    if os.path.exists("sample_data.json") and "sample_data.json" not in files:
        files.append("sample_data.json")
        
    return jsonify({"files": files, "current": CURRENT_FILE})

@app.route('/api/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400
    if file and file.filename.endswith('.json'):
        filepath = os.path.join("data", file.filename)
        file.save(filepath)
        return jsonify({"status": "success", "filename": file.filename})
    return jsonify({"error": "Invalid file type"}), 400

@app.route('/api/switch_file', methods=['POST'])
def switch_file():
    req = request.json
    filename = req.get('filename')
    if not filename:
         return jsonify({"error": "Filename required"}), 400
    
    success = load_data(filename)
    if success:
        return jsonify({"status": "success", "current": filename})
    else:
        return jsonify({"error": "Failed to load file"}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)
