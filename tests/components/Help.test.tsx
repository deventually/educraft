import { describe, it, expect } from "vitest";
import type { ComponentProps } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";
import HelpIndex from "~/routes/help._index";
import HelpPage from "~/routes/help.$id";

// createRoutesStub does not inject the loaderData prop (that's framework-mode
// behaviour), so we pass it via a wrapper while still rendering inside the
// stub's data router (needed for <Link> / router context). Mirrors the pattern
// in About.test.tsx and Projects.test.tsx.

const indexData = {
  sections: [
    {
      id: "start",
      title: "Begin hier",
      topics: [
        {
          slug: "getting-started",
          title: "Aan de slag",
          search: "aan de slag kies een tool",
          headings: [],
        },
      ],
    },
    {
      id: "account",
      title: "Je account",
      topics: [
        {
          slug: "account",
          title: "Je account",
          search: "je account tweestapsverificatie herstelcodes",
          headings: [{ text: "Tweestapsverificatie", anchor: "tweestapsverificatie" }],
        },
      ],
    },
  ],
  toolGroups: [
    {
      goal: "design",
      name: { nl: "Plannen & ontwerpen", en: "Plan & design" },
      tools: [
        {
          id: "bloom-by-design",
          name: { nl: "Bloom by Design", en: "Bloom by Design" },
          tagline: {
            nl: "Kies technologie op basis van leerresultaten",
            en: "Choose technology by learning outcome",
          },
          search: "bloom by design technologie",
        },
      ],
    },
  ],
};

const tool = {
  id: "bloom-by-design",
  slug: "bloom-by-design",
  name: { nl: "Bloom by Design", en: "Bloom by Design" },
  tagline: {
    nl: "Kies technologie op basis van leerresultaten",
    en: "Choose technology by learning outcome",
  },
  theory: {
    name: { nl: "Constructive alignering", en: "Constructive alignment" },
    summary: { nl: "Stem activiteiten, toetsing en technologie op elkaar af.", en: "Align." },
    keyCitations: [],
  },
  inputs: [
    {
      name: "outcome",
      label: { nl: "Leerresultaat", en: "Learning outcome" },
      kind: "text" as const,
      help: { nl: "Wat studenten moeten kunnen.", en: "What students should be able to do." },
    },
  ],
};

const toolPageData = {
  kind: "tool" as const,
  tool,
  overlay: "## Wanneer gebruik je deze tool?\n\nAls je twijfelt welke technologie past.",
};

const topicPageData = {
  kind: "topic" as const,
  title: "Aan de slag",
  body: "# Aan de slag\n\nKies een tool en stel je context in.",
};

// happy-dom loads no stylesheet, so axe can't compute real contrast and falsely
// flags text (fg == bg); disable color-contrast as elsewhere in the suite.
const axeOpts = { rules: { "color-contrast": { enabled: false } } };

function renderIndex() {
  const props = { loaderData: indexData } as unknown as ComponentProps<typeof HelpIndex>;
  const Stub = createRoutesStub([{ path: "/", Component: () => <HelpIndex {...props} /> }]);
  return render(<Stub initialEntries={["/"]} />);
}

function renderPage(loaderData: unknown) {
  const props = { loaderData } as unknown as ComponentProps<typeof HelpPage>;
  const Stub = createRoutesStub([{ path: "/", Component: () => <HelpPage {...props} /> }]);
  return render(<Stub initialEntries={["/"]} />);
}

describe("Help index", () => {
  it("lists topics and tools", () => {
    renderIndex();
    expect(screen.getByText("Aan de slag")).toBeInTheDocument();
    expect(screen.getByText("Bloom by Design")).toBeInTheDocument();
  });

  it("groups topics under section headings and tools under their goal", () => {
    renderIndex();
    expect(screen.getByRole("heading", { name: "Begin hier" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Plannen & ontwerpen" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Aan de slag/ })).toHaveAttribute(
      "href",
      "/help/getting-started",
    );
  });

  it("searches topics and tools, and links straight to the matching heading", async () => {
    renderIndex();
    await userEvent.type(screen.getByRole("searchbox", { name: "Zoek in de help" }), "tweestap");
    const results = screen.getByRole("region", { name: "Zoekresultaten" });
    expect(within(results).getByRole("link", { name: "Je account" })).toHaveAttribute(
      "href",
      "/help/account",
    );
    expect(within(results).getByRole("link", { name: "Tweestapsverificatie" })).toHaveAttribute(
      "href",
      "/help/account#tweestapsverificatie",
    );
    expect(within(results).queryByText("Bloom by Design")).toBeNull();
    expect(screen.getByText("1 resultaat")).toBeInTheDocument();
  });

  it("says so when the search finds nothing", async () => {
    renderIndex();
    await userEvent.type(screen.getByRole("searchbox", { name: "Zoek in de help" }), "xyzzy");
    expect(screen.getByText(/Niets gevonden/)).toBeInTheDocument();
  });

  it("has no a11y violations while searching", async () => {
    const { container } = renderIndex();
    await userEvent.type(screen.getByRole("searchbox", { name: "Zoek in de help" }), "tweestap");
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("has no a11y violations", async () => {
    const { container } = renderIndex();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});

describe("Help tool page", () => {
  it("renders the registry-derived overview plus the overlay", () => {
    renderPage(toolPageData);
    expect(screen.getByRole("heading", { name: "Bloom by Design" })).toBeInTheDocument();
    expect(screen.getByText("Leerresultaat")).toBeInTheDocument();
    expect(screen.getByText("Wanneer gebruik je deze tool?")).toBeInTheDocument();
  });

  it("has no a11y violations", async () => {
    const { container } = renderPage(toolPageData);
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});

describe("Help topic page", () => {
  it("renders the topic markdown body", () => {
    renderPage(topicPageData);
    expect(screen.getByRole("heading", { name: "Aan de slag" })).toBeInTheDocument();
  });

  it("has no a11y violations", async () => {
    const { container } = renderPage(topicPageData);
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});
