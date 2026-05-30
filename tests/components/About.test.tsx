import { describe, it, expect } from "vitest";
import type { ComponentProps } from "react";
import { render, screen } from "@testing-library/react";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";
import About from "~/routes/about";

const tools = [
  { name: { nl: "Docent Tool", en: "Instructor Tool" }, userType: "instructor" as const },
  { name: { nl: "Student Tool", en: "Student Tool" }, userType: "student" as const },
];

function renderAbout() {
  // createRoutesStub does not inject the loaderData prop, so pass it via a
  // wrapper while keeping the stub's router context (useLocale → root loader).
  const props = { loaderData: { tools } } as unknown as ComponentProps<typeof About>;
  const Stub = createRoutesStub([{ path: "/", Component: () => <About {...props} /> }]);
  return render(<Stub initialEntries={["/"]} />);
}

describe("About / tools catalog", () => {
  it("groups tools by audience instead of phase", () => {
    renderAbout();
    expect(screen.getByText("Voor docenten")).toBeInTheDocument();
    expect(screen.getByText("Voor studenten")).toBeInTheDocument();
    expect(screen.getByText("Docent Tool")).toBeInTheDocument();
    expect(screen.getByText("Student Tool")).toBeInTheDocument();
  });

  it("no longer shows phase or coming-soon labels", () => {
    renderAbout();
    expect(screen.queryByText(/MVP/)).toBeNull();
    expect(screen.queryByText("Binnenkort")).toBeNull();
  });

  it("has no a11y violations", async () => {
    const { container } = renderAbout();
    const results = await axe(container, {
      rules: { "color-contrast": { enabled: false } },
    });
    expect(results.violations).toEqual([]);
  });
});
