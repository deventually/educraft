import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";
import { HelpLink } from "~/components/HelpLink";

const axeOpts = { rules: { "color-contrast": { enabled: false } } };

function renderAt(locale: "nl" | "en") {
  const Stub = createRoutesStub([
    {
      id: "root",
      path: "/",
      loader: () => ({ locale }),
      Component: () => <HelpLink topic="saved-work" />,
    },
  ]);
  return render(<Stub initialEntries={["/"]} />);
}

describe("HelpLink", () => {
  it("is one quiet link to the topic, with a short question as its text", async () => {
    renderAt("nl");
    const link = await screen.findByRole("link", { name: "Hoe werkt dit?" });
    expect(link).toHaveAttribute("href", "/help/saved-work");
  });

  it("speaks English in English", async () => {
    renderAt("en");
    expect(await screen.findByRole("link", { name: "How does this work?" })).toBeInTheDocument();
  });

  it("has no a11y violations", async () => {
    const { container } = renderAt("nl");
    await screen.findByRole("link");
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});
