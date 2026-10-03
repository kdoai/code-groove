from html import escape
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
STYLE = "text{font-family:Arial,sans-serif;fill:#253044}.title{font-size:34px;font-weight:700}.sub{font-size:18px;fill:#64738b}.label{font-size:23px;font-weight:600}.small{font-size:17px;fill:#596982}.box{fill:#fff;stroke:#d4dbea;stroke-width:2;rx:12}.line{fill:none;stroke:#7587ac;stroke-width:2;marker-end:url(#arrow)}"


def document(title, subtitle):
    return [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="920" viewBox="0 0 1440 920"><defs><marker id="arrow" markerWidth="9" markerHeight="9" refX="8" refY="4" orient="auto"><path d="M0 0L8 4L0 8" fill="none" stroke="#7587ac" stroke-width="1.5"/></marker><style>{STYLE}</style></defs><rect width="1440" height="920" fill="#f7f8fc"/>',
        f'<text x="60" y="72" class="title">{escape(title)}</text>',
        f'<text x="60" y="110" class="sub">{escape(subtitle)}</text>',
    ]


def box(parts, x, y, width, height, title, lines):
    parts.append(f'<rect x="{x}" y="{y}" width="{width}" height="{height}" class="box"/>')
    parts.append(f'<text x="{x + 22}" y="{y + 39}" class="label">{escape(title)}</text>')
    for i, line in enumerate(lines):
        parts.append(f'<text x="{x + 22}" y="{y + 73 + i * 28}" class="small">{escape(line)}</text>')


def arrow(parts, x1, y1, x2, y2, label=""):
    parts.append(f'<path d="M{x1} {y1} L{x2} {y2}" class="line"/>')
    if label:
        parts.append(
            f'<text x="{(x1 + x2) / 2}" y="{(y1 + y2) / 2 - 10}" text-anchor="middle" class="small">{escape(label)}</text>'
        )


def save(name, parts):
    (ROOT / "docs" / f"{name}.svg").write_text("".join(parts) + "</svg>", encoding="utf-8")


def main():
    parts = document(
        "Code Groove / Agent & playback sequence",
        "Immutable evidence. Bounded tools. No model request during replay.",
    )
    actors = [
        (160, "Browser"),
        (440, "Web / Auth"),
        (720, "Worker / Queue"),
        (1000, "Gemini SDK"),
        (1280, "Private store"),
    ]
    for x, name in actors:
        box(parts, x - 105, 145, 210, 80, name, [])
        parts.append(f'<path d="M{x} 225V810" stroke="#cbd5e6" stroke-dasharray="6 6"/>')
    for y, a, b, label in [
        (275, 0, 1, "1. Login / owner-scoped source"),
        (335, 1, 2, "2. Reserve quota / OIDC task"),
        (395, 2, 4, "3. Pin / sanitize / index snapshot"),
        (465, 2, 3, "4. Ask with authorized tool schema"),
        (525, 3, 2, "5. Read / relations / alternative"),
        (605, 2, 4, "6. Validate evidence / compile score"),
        (675, 0, 1, "7. Retrieve saved interpretation"),
        (735, 1, 0, "8. Notes + exact source spans"),
    ]:
        arrow(parts, actors[a][0], y, actors[b][0], y, label)
    parts.append(
        '<rect x="640" y="415" width="438" height="145" fill="none" stroke="#8596bc" stroke-dasharray="5 4" rx="10"/><text x="663" y="437" class="small">Bounded adaptive tool loop</text>'
    )
    parts.append(
        '<text x="60" y="870" class="sub">Identical refresh: source validation + index cache + analysis cache, zero model calls. Changed: affected semantic units only.</text>'
    )
    save("sequence", parts)
    parts = document(
        "Code Groove / Data flow & trust boundaries",
        "Source is data, never executable. Firebase identifies the owner; metadata authorizes every access.",
    )
    parts.append(
        '<rect x="470" y="160" width="910" height="600" fill="#eef1fb" stroke="#c8d3eb" rx="20"/><text x="494" y="196" class="small">Google Cloud / private workload boundary</text>'
    )
    box(
        parts,
        60,
        210,
        320,
        158,
        "User / browser",
        ["Invited password login", "Questions / public repo URL", "Audio notes + source evidence"],
    )
    box(
        parts,
        60,
        520,
        320,
        150,
        "Public GitHub",
        ["HTTPS owner/repo allowlist", "Bounded sanitized archive", "No scripts / imports executed"],
    )
    box(
        parts,
        510,
        230,
        330,
        155,
        "Protected Web API",
        ["Firebase + server allowlist", "Ownership / origin / size", "Atomic quotas / expiry"],
    )
    box(
        parts,
        1000,
        230,
        335,
        155,
        "Private Worker",
        ["OIDC / durable lease", "Read tools / bounded drafts", "Reverified change reuse"],
    )
    box(
        parts,
        510,
        540,
        330,
        180,
        "Firestore + Storage",
        [
            "Owner-scoped metadata",
            "Immutable snapshot / result",
            "Private IAM / TTL / lifecycle",
            "No direct browser access",
        ],
    )
    box(
        parts,
        1000,
        540,
        335,
        180,
        "Gemini on Google Cloud",
        [
            "Gen AI SDK / ADC",
            "Sanitized selected evidence",
            "Structured claims / alternatives",
            "No source write / approval tools",
        ],
    )
    arrow(parts, 380, 275, 510, 275, "source / question")
    arrow(parts, 840, 315, 1000, 315, "OIDC task")
    arrow(parts, 380, 580, 460, 580)
    arrow(parts, 460, 580, 460, 425)
    arrow(parts, 460, 425, 1100, 425, "pinned source / static index")
    arrow(parts, 1100, 425, 1100, 385)
    arrow(parts, 670, 385, 670, 540, "metadata / saved score")
    arrow(parts, 1000, 385, 840, 540, "snapshot / proofs / result")
    arrow(parts, 1167, 385, 1167, 540, "tools / validated candidate")
    parts.append(
        '<text x="60" y="835" class="sub">Secret Manager: reviewer password. GitHub WIF: short-lived deploy identity. Logs exclude tokens, passwords and raw source.</text>'
    )
    parts.append(
        '<text x="60" y="875" class="small">Public samples: authored fixtures or explicitly recorded real Gemini results. They never silently replace failed live analysis.</text>'
    )
    save("data-flow", parts)
    parts = document(
        "Code Groove / Why this rhythm?",
        "The Agent judges code. The deterministic compiler composes. The player reveals the evidence.",
    )
    box(
        parts,
        60,
        190,
        375,
        240,
        "1 / Agent interpretation",
        [
            "Read exact functions + context",
            "Ask: same reason to change?",
            "Check alternative contracts",
            "Concern / justified / unknown",
            "Concrete changes / reading tasks",
        ],
    )
    box(
        parts,
        525,
        190,
        380,
        240,
        "2 / Musical arrangement",
        [
            "Same M0-M5 identity / data notes",
            "Four-bar question and answer",
            "Rootless voicing / walking bass",
            "Swing / rests / no drums",
            "Fixed evidence-linked echo cues",
        ],
    )
    box(
        parts,
        995,
        190,
        385,
        240,
        "3 / DTM workspace",
        [
            "Repository directory tree",
            "File/function clips + all notes",
            "Separate common backing tracks",
            "Audible note -> exact file lines",
            "Always available Agent questions",
        ],
    )
    arrow(parts, 435, 305, 525, 305)
    arrow(parts, 905, 305, 995, 305)
    box(
        parts,
        60,
        530,
        635,
        210,
        "Shared decisions / checked concern",
        [
            "Hypothesis: policy window or fee changes",
            "Two code owners must change together",
            "A shifted musical response is added in both clips",
            "Amber ranges link to read evidence; backing is reduced",
        ],
    )
    box(
        parts,
        745,
        530,
        635,
        210,
        "Independent contracts / justified boundary",
        [
            "Evidence supports separate reasons to change",
            "No diagnostic response is added",
            "Same musical vocabulary and deterministic accompaniment",
            "No concern is not a safety guarantee or a quality score",
        ],
    )
    parts.append(
        '<text x="60" y="840" class="sub">Accompaniment is musical context, not a code claim. Unread code gets no invented events. Scores and kits have stable hashes.</text>'
    )
    save("sonification", parts)
    parts = document(
        "Code Groove / Human-approved improvement",
        "A proposal changes nothing. Approval creates an app-only snapshot; independent review may retain a concern.",
    )
    actors = [
        (180, "Human / browser"),
        (510, "Protected API"),
        (860, "Worker / Gemini"),
        (1220, "Private store"),
    ]
    for x, name in actors:
        box(parts, x - 130, 150, 260, 80, name, [])
        parts.append(f'<path d="M{x} 230V830" stroke="#cbd5e6" stroke-dasharray="6 6"/>')
    for y, a, b, label in [
        (280, 0, 1, "1. Request a grounded improvement"),
        (340, 1, 2, "2. Reserve shared investigation quota"),
        (400, 2, 3, "3. Read base / tools / exact edit validation"),
        (460, 2, 3, "4. Store immutable draft + evidence"),
        (520, 1, 0, "5. Show diff / tradeoffs / pending checks"),
        (595, 0, 1, "6. Explicit accept or reject (no auto approval)"),
        (665, 1, 3, "7. CAS base + draft state + analysis budget"),
        (735, 1, 2, "8. Re-index / review accepted snapshot"),
        (805, 2, 3, "9. Preserve original / publish new score"),
    ]:
        arrow(parts, actors[a][0], y, actors[b][0], y, label)
    parts.append(
        '<text x="60" y="875" class="sub">Compare with stable responsibility motifs. No GitHub writes or repository execution. Reject keeps the original; replay makes no model request.</text>'
    )
    save("approval-sequence", parts)
    architecture = ROOT / "docs/architecture.svg"
    value = (
        architecture.read_text(encoding="utf-8")
        .replace("Theme / Repo · Inspect", "Clips / notes / code evidence")
        .replace(
            "Read code. Hear responsibilities. Follow the evidence.",
            "Investigate design. Hear its rhythm. Follow exact source evidence.",
        )
        .replace("Validate → compile score", "Validate / reuse → compose")
    )
    architecture.write_text(value, encoding="utf-8")


if __name__ == "__main__":
    main()
