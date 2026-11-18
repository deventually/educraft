import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { axe } from "vitest-axe";
import { ToolHeader } from "~/components/tool/ToolHeader";
import { getMessages } from "~/lib/i18n";
import { loc } from "~/lib/i18n/localized";
import { getToolBySlug } from "~/lib/registry";

const t = getMessages("nl");

function show(slug: string) {
  const tool = getToolBySlug(slug)!;
  const view = render(
    <MemoryRouter>
      <ToolHeader tool={tool} verbatim={[]} helpOverlay={null} locale="nl" t={t} />
    </MemoryRouter>,
  );
  return { tool, tagline: loc(tool.tagline, "nl"), ...view };
}

describe("ToolHeader", () => {
  it("keeps a chat tool's header to one slim bar: the tagline waits behind 'Onderbouwing & bron'", async () => {
    const user = userEvent.setup();
    const { tool, tagline, container } = show("mentorai");

    expect(screen.getByRole("heading", { level: 1, name: loc(tool.name, "nl") })).toBeVisible();
    expect(screen.queryByText(tagline)).toBeNull();

    await user.click(screen.getByRole("button", { name: /Onderbouwing & bron/ }));
    expect(screen.getByText(tagline)).toBeVisible();
    expect((await axe(container)).violations).toEqual([]);
  });

  it("shows the tagline straight away for a form tool, which has room for it", async () => {
    const { tagline, container } = show("arcs-reactor");

    expect(screen.getByText(tagline)).toBeVisible();
    expect((await axe(container)).violations).toEqual([]);
  });
});
