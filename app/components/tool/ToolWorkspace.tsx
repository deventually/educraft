import type { ComponentProps, ReactNode } from "react";
import { ChatView } from "~/components/ChatView";
import { GeneratorView } from "~/components/GeneratorView";
import { StageStepper } from "~/components/StageStepper";
import type { ToolKind } from "~/lib/registry/modes";

/** What every workspace gets from the tool page; a chat also gets the text for students. */
export type WorkspaceProps = ComponentProps<typeof GeneratorView> & {
  studentPrompt?: Record<"nl" | "en", string>;
};

/**
 * One workspace per kind of tool (`modeOf(tool).kind`): a new kind is a new entry here,
 * never a branch in the route.
 */
const WORKSPACES: Record<ToolKind, (props: WorkspaceProps) => ReactNode> = {
  chat: ({ profiles, defaultProfileId, ...props }) => (
    <ChatView {...props} contextProfile={profiles.find((p) => p.id === defaultProfileId) || null} />
  ),
  multiStage: ({ studentPrompt: _, ...props }) => <StageStepper {...props} />,
  oneShot: ({ studentPrompt: _, ...props }) => <GeneratorView {...props} />,
};

export function ToolWorkspace({ kind, ...props }: WorkspaceProps & { kind: ToolKind }) {
  const Workspace = WORKSPACES[kind];
  return <Workspace {...props} />;
}
