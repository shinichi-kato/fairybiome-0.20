
import { graphql, useStaticQuery } from 'gatsby';

export const useBackgroundPalette = (): string[] => {
  const data = useStaticQuery(graphql`
    query PaletteQuery {
      site {
        siteMetadata {
          backgroundColorPalette
        }
      }
    }
  `);
  return data.site.siteMetadata.backgroundColorPalette;
};
``
