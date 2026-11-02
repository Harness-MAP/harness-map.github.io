"""Display names for harness files on the project page.

On disk every harness of the recorded runs has its entry module at harness.py; the public method repo renamed that
skeleton file to agent.py (2026-11-02), so the page shows it as agent.py.  Every tool that writes anatomy rows (anatomy.py,
cases.py, same_game_cases.py, easy_pack.py, process_video.py) applies this mapping at output, so regenerated data
keeps the page name while the search code keeps reading harness.py.
"""
ON_DISK, SHOWN = "harness.py", "agent.py"
MOD_ON_DISK, MOD_SHOWN = "harness", "agent"


def file_name(rel):
    """Page name of a harness file given its path relative to the candidate directory."""
    return SHOWN if rel == ON_DISK else rel


def mod_name(stem):
    """Page name of a module given its stem (graph node names and edge endpoints)."""
    return MOD_SHOWN if stem == MOD_ON_DISK else stem


def rename_anatomy(row):
    """Apply the display names in place to an anatomy or case row (modules, edges, entry) and return it."""
    if not row:
        return row
    for m in row.get("modules") or []:
        m["file"] = file_name(m["file"]); m["name"] = mod_name(m["name"])
    if row.get("edges"):
        row["edges"] = [[mod_name(a), mod_name(b), *rest] for a, b, *rest in row["edges"]]
    ent = row.get("entry")
    if ent and ent.get("file"):
        ent["file"] = file_name(ent["file"])
    return row
