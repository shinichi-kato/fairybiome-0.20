
import { graphql, useStaticQuery } from 'gatsby';

export type AvatarSet = {
  dir: string;
  avatarURL: string; // 顔1:1
  peaceURL: string;  // 上半身4:3
};

export const useUserAvatarSets = (): AvatarSet[] => {
  const data = useStaticQuery(graphql`
    query AvatarPairFiles {
      allFile(filter: {sourceInstanceName: {eq: "userAvatar"}, extension: {eq: "svg"}}) {
        nodes {
          relativeDirectory
          name
          publicURL
        }
      }
    }
  `);

  const byDir: Record<string, { avatarURL?: string; peaceURL?: string }> = {};

  data.allFile.nodes.forEach((n: any) => {
    const dir = n.relativeDirectory.split('/').pop() || '';
    if (!byDir[dir]) byDir[dir] = {};
    if (n.name === 'avatar') byDir[dir].avatarURL = n.publicURL;
    if (n.name === 'peace') byDir[dir].peaceURL = n.publicURL;
  });

  return Object.entries(byDir)
    .filter(([, v]) => v.avatarURL && v.peaceURL)
    .map(([dir, v]) => ({ dir, avatarURL: v.avatarURL!, peaceURL: v.peaceURL! }));
};
