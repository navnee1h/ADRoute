import networkx as nx
import json
# 2️⃣ Exploit Difficulty Weight Model
EDGE_WEIGHTS = {
    "MemberOf": 0.1,              # Automatic privilege inheritance
    "AdminTo": 1.0,
    "GenericAll": 2.0,
    "WriteOwner": 2.5,
    "WriteDacl": 3.0,
    "AddMember": 3.5,
    "Kerberoastable": 5.0,
    "ASREPRoastable": 4.5,
    "UnconstrainedDelegation": 6.0,
    "ShadowCredentials": 7.0,
    "DCSync": 10.0,
    # Fallback/others
    "Owns": 2.0,
    "WriteSPN": 4.0,
    "AddSelf": 3.5,
    "ForceChangePassword": 3.0,
    "GenericWrite": 3.0,
    "AllExtendedRights": 3.0,
    "HasSession": 0.5,
    # GPO
    "GPLink": 0.1,
    "EditGPO": 2.0,
    "EditSettings": 2.0,
    # ADCS
    "Enroll": 3.0,
    "AllIssuancePolicy": 4.0,
    "Certificate-Enrollment": 3.0,
    "Enrollment-Agent": 4.0,
    "WriteCertAny": 5.0
}

def get_edge_weight(edge_type: str) -> float:
    """
    Returns exploitation difficulty score.
    Lower = easier, stealthier
    """
    return EDGE_WEIGHTS.get(edge_type, 5.0)

def build_graph(json_data: dict) -> nx.DiGraph:
    """
    Builds a NetworkX Directed Graph from SharpHound-like JSON data.
    """
    G = nx.DiGraph()

    # SharpHound data usually comes in a 'data' list
    items = json_data.get("data", [])

    for item in items:
        # Node Identifier
        node_id = item.get("ObjectIdentifier")
        if not node_id:
            continue
        
        node_id = node_id.upper()
        node_type = item.get("ObjectType", "Unknown")
        props = item.get("Properties", {})
        label = props.get("name", node_id)

        # Add Node
        if not G.has_node(node_id):
            G.add_node(node_id, label=label, type=node_type, owned=False)
        else:
            # Update existing node if encountered again (e.g. from different file merge in real app)
            # merging attributes
            pass
        
        # 1. Process Aces (Access Control Entries)
        aces = item.get("Aces", [])
        for ace in aces:
            target_id = ace.get("PrincipalSID")  # In simplified model, Principal is the one WITH access. 
            # In SharpHound: item is the TARGET object. Principal has current 'RightName' ON 'item'.
            # So edge is Principal -> Item.
            
            # Wait, verify directionality. 
            # SharpHound Node A has ACE: Principal B has Right X.
            # Means B -> (X) -> A.
            # Example: Domain Admin Group (Principal) is AdminTo (Right) Computer (Item).
            # Edge: Group -> Computer.
            
            if not target_id:
                continue
                
            source_node = target_id.upper()
            target_node = node_id # The item itself
            
            rel_type = ace.get("RightName", "Unknown")
            weight = get_edge_weight(rel_type)
            
            G.add_edge(
                source_node, 
                target_node, 
                relationship=rel_type, 
                weight=weight,
                technique="ACL"
            )
            
            # Ensure source node exists even if we haven't processed its full entry yet
            if not G.has_node(source_node):
                principal_type = ace.get("PrincipalType", "Unknown")
                G.add_node(source_node, label=source_node, type=principal_type, owned=False)

        # 2. Process MemberOf (Explicit Membership)
        # Note: SharpHound 4 often puts group membership in 'IsGroups' or 'GroupMembership' depending on collection method.
        # But commonly we might see 'Members' on the Group object, OR 'MemberOf' list on the User object.
        # It's safest to handle what we see.
        
        # Handling direct "Members" list if present (Group -> Member relation?)
        # Actually Group object has 'Members'. 
        # Relation: Member is MemberOf Group. 
        # Edge: Member -> Group (weight 0.1).
        
        members = item.get("Members", [])
        for member in members:
            member_id = member.get("ObjectIdentifier")
            if not member_id:
                continue
            member_id = member_id.upper()
            
            # Member -> Item(Group)
            G.add_edge(
                member_id,
                node_id,
                relationship="MemberOf",
                weight=get_edge_weight("MemberOf"),
                technique="GroupMembership"
            )
            if not G.has_node(member_id):
                 G.add_node(member_id, label=member_id, type=member.get("ObjectType", "User"), owned=False)

    return G

def calculate_shortest_path(G: nx.DiGraph, source: str, target: str):
    """
    Number of hops (BFS).
    """
    try:
        path = nx.shortest_path(G, source, target)
        return path
    except nx.NetworkXNoPath:
        return None

def calculate_easiest_path(G: nx.DiGraph, source: str, target: str):
    """
    Minimum weight sum (Dijkstra).
    """
    try:
        path = nx.dijkstra_path(G, source, target, weight="weight")
        return path
    except nx.NetworkXNoPath:
        return None

def calculate_paths_from_owned(G: nx.DiGraph, owned_nodes: list, target_node: str):
    """
    Multi-source Dijkstra: attacker can start from ANY owned node.
    """
    best_path = None
    best_cost = float("inf")

    for src in owned_nodes:
        if not G.has_node(src):
            continue
            
        try:
            cost = nx.dijkstra_path_length(G, src, target_node, weight="weight")
            if cost < best_cost:
                best_cost = cost
                best_path = nx.dijkstra_path(G, src, target_node, weight="weight")
        except nx.NetworkXNoPath:
            continue

    return best_path, best_cost

def calculate_centrality(G: nx.DiGraph):
    """
    Betweenness Centrality to find choke points.
    """
    # For large graphs, k=k ensures we don't run forever (approximation)
    # Using weight='weight' means 'shortest' paths are calculated using weights (cheapest paths)
    # This is important: choke points for ATTACKERS are nodes on the Easiest Paths.
    try:
        centrality = nx.betweenness_centrality(G, weight="weight", normalized=True)
        return centrality
    except Exception as e:
        print(f"Error calculating centrality: {e}")
        return {}

if __name__ == "__main__":
    # Test with sample data
    try:
        with open("sample_data.json", "r") as f:
            data = json.load(f)
        G = build_graph(data)
        print(f"Graph built successfully: {G.number_of_nodes()} nodes, {G.number_of_edges()} edges.")
        
        # Validate an edge
        for u, v, d in G.edges(data=True):
            print(f"{u} -> {v} : {d}")
            break
            
        # Test Pathfinding
        # In sample: GROUP-ADMINS -> WriteDacl -> USER-ALICE -> Kerberoastable -> USER-EVE (Reverse?)
        # Let's check aces:
        # BOB -(MemberOf)-> ADMINS
        # DC01 -(AdminTo)-> ADMINS (Wait, usually AdminTo is Group -> Computer)
        #   My sample data aces:
        #   ADMINS has ace from DC01 (Principal). Right: AdminTo. 
        #   So DC01 -> ADMINS.
        
        # ALICE has ace from ADMINS. Right: WriteDacl.
        #   ADMINS -> ALICE. (So Bob -> Admins -> Alice)
        
        # EVE has ace from ALICE. Right: Kerberoastble.
        #   ALICE -> EVE.
        
        # Path: BOB -> ADMINS -> ALICE -> EVE
        
        path = calculate_shortest_path(G, "USER-BOB@CONTOSO.LOCAL", "USER-EVE@CONTOSO.LOCAL")
        print(f"Shortest Path Bob->Eve: {path}")
        
        epath = calculate_easiest_path(G, "USER-BOB@CONTOSO.LOCAL", "USER-EVE@CONTOSO.LOCAL")
        print(f"Easiest Path Bob->Eve: {epath}")
         
    except FileNotFoundError:
        print("sample_data.json not found.")

