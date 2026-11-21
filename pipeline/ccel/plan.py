"""Work map: which ThML divs of which CCEL volume form which library work.

Each volume entry is a list of specs:
  W(divs, author, slug, title, ...)   one work made of the listed divs (in order)
  G(container, author, ...)           every child div of `container` is a work; introductory notes
                                      attach to the next work, elucidations/notes to the previous one
  SKIP(divs, reason)                  divs deliberately not ingested (reported by the audit)
Div ids may be written as ranges "a..b" meaning every sibling from a to b inclusive.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field

INTRO_RX = re.compile(
    r"^(introductory|introduction|preface|prologue|prefatory|argument\b|extract from|translator|"
    r"title page|second title|notice|the opinion of st\. augustin|prolegomena to|analysis|contents of|"
    r"additional introduction|introductory note)",
    re.I,
)
POST_RX = re.compile(r"^(elucidation|note by the american|general note|note\.?$|notes?\b|additional note|appendix note)", re.I)
SKIP_RX = re.compile(r"^(title page\.?$|title pages\.?$|contents|table of contents|credits|indexes|index\b|subject index)", re.I)


@dataclass
class W:
    divs: list
    author: str
    slug: str
    title: str
    coll: str = ""
    lang: str = ""
    unwrap: list | None = None  # div ids whose children become top-level sections
    translator: str | None = None
    short_title: str | None = None
    date: str | None = None
    order: int = 0
    vol: str = ""
    label: str | None = None  # number unwrapped children "<label> I", "<label> II", ... from label_from on
    label_from: str | None = None


@dataclass
class G:
    container: str
    author: str
    coll: str = ""
    lang: str = ""
    names: dict = field(default_factory=dict)  # child div id -> (slug, title) or slug
    skip: list = field(default_factory=list)  # child div ids to skip
    translator: str | None = None
    prefix_intro_to: dict = field(default_factory=dict)
    authors: dict = field(default_factory=dict)  # child div id -> author override
    langs: dict = field(default_factory=dict)
    pre: list = field(default_factory=list)  # div ids outside the container prepended to its first work
    post: list = field(default_factory=list)  # div ids appended to its last work
    titles: dict = field(default_factory=dict)  # child div id -> title override (slug from title)


@dataclass
class SKIP:
    divs: list
    reason: str


@dataclass
class VolumeSpec:
    name: str
    coll: str
    edition: str
    year: int
    specs: list
    lang: str = "Greek"
