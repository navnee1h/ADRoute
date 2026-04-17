import json
import networkx as nx
from graph_logic import build_graph, calculate_shortest_path, calculate_easiest_path

try:
    with open("sample_data.json", "r") as f:
        data = json.load(f)
    
    G = build_graph(data)
    
    print(f"--- Graph Info: {G.number_of_nodes()} nodes, {G.number_of_edges()} edges ---")
    
    source = "USER-INTERN@CORP.LOCAL"
    target = "COMPUTER-DC01@CORP.LOCAL"
    
    print(f"\n--- Checking Path: {source} -> {target} ---")
    
    shortest = calculate_shortest_path(G, source, target)
    print("Shortest Path (Hops):", shortest)
    
    easiest = calculate_easiest_path(G, source, target)
    print("Easiest Path (Weight):", easiest)

except Exception as e:
    print(f"Error: {e}")
