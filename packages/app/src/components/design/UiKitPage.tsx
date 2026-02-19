import {
  CodeSnippet,
  Content,
  Header,
  InfoCard,
  Page,
  SupportButton,
  CopyTextButton,
} from '@backstage/core-components';
import {
  Box,
  Button,
  Grid,
  Paper,
  TextField,
  Typography,
} from '@material-ui/core';
import { makeStyles, useTheme } from '@material-ui/core/styles';

type TokensStudioToken = {
  value: string | number;
  type?: string;
};

type TokensStudioSet = Record<string, unknown>;

const useStyles = makeStyles(
  theme => ({
    swatchRow: {
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1.5),
      marginBottom: theme.spacing(1),
    },
    swatch: {
      width: 28,
      height: 28,
      borderRadius: theme.shape.borderRadius,
      border: `1px solid ${theme.palette.divider}`,
    },
    swatchLabel: {
      fontFamily: theme.typography.fontFamily,
    },
    tokenActions: {
      display: 'flex',
      justifyContent: 'flex-end',
      marginTop: theme.spacing(1),
    },
    componentRow: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: theme.spacing(1),
      alignItems: 'center',
    },
    componentBox: {
      padding: theme.spacing(2),
      background: theme.palette.background.default,
      border: `1px solid ${theme.palette.divider}`,
    },
  }),
  { name: 'UiKitPage' },
);

function colorToken(value: string): TokensStudioToken {
  return { value, type: 'color' };
}

function numberToken(value: number): TokensStudioToken {
  return { value, type: 'number' };
}

function buildTokensStudioSet(theme: any): TokensStudioSet {
  const spacingBase = typeof theme.spacing === 'function' ? theme.spacing(1) : 8;

  return {
    global: {
      color: {
        primary: {
          main: colorToken(theme.palette.primary.main),
          light: colorToken(theme.palette.primary.light),
          dark: colorToken(theme.palette.primary.dark),
        },
        secondary: {
          main: colorToken(theme.palette.secondary.main),
          light: colorToken(theme.palette.secondary.light),
          dark: colorToken(theme.palette.secondary.dark),
        },
        status: {
          error: colorToken(theme.palette.error.main),
          warning: colorToken(theme.palette.warning.main),
          info: colorToken(theme.palette.info.main),
          success: colorToken(theme.palette.success.main),
        },
        text: {
          primary: colorToken(theme.palette.text.primary),
          secondary: colorToken(theme.palette.text.secondary),
        },
        background: {
          default: colorToken(theme.palette.background.default),
          paper: colorToken(theme.palette.background.paper),
        },
        divider: colorToken(theme.palette.divider),
      },
      typography: {
        fontFamily: { value: theme.typography.fontFamily, type: 'fontFamilies' },
        fontSize: numberToken(theme.typography.fontSize),
      },
      spacing: {
        base: numberToken(spacingBase),
        s1: numberToken(spacingBase * 1),
        s2: numberToken(spacingBase * 2),
        s3: numberToken(spacingBase * 3),
        s4: numberToken(spacingBase * 4),
        s6: numberToken(spacingBase * 6),
      },
      radius: {
        sm: numberToken(theme.shape.borderRadius),
      },
    },
  };
}

export function UiKitPage() {
  const classes = useStyles();
  const theme = useTheme();

  const tokens = buildTokensStudioSet(theme);
  const tokensJson = JSON.stringify(tokens, null, 2);

  const swatches = [
    ['Primary', theme.palette.primary.main],
    ['Secondary', theme.palette.secondary.main],
    ['Error', theme.palette.error.main],
    ['Warning', theme.palette.warning.main],
    ['Info', theme.palette.info.main],
    ['Success', theme.palette.success.main],
    ['Text primary', theme.palette.text.primary],
    ['Text secondary', theme.palette.text.secondary],
    ['Background default', theme.palette.background.default],
    ['Background paper', theme.palette.background.paper],
    ['Divider', theme.palette.divider],
  ] as const;

  return (
    <Page themeId="tool">
      <Header title="UI Kit" subtitle="Backstage theme tokens + component examples">
        <SupportButton>
          Use this as a lightweight “design kit” reference. The token JSON is
          compatible with Tokens Studio (Figma) style structures.
        </SupportButton>
      </Header>
      <Content>
        <Grid container spacing={3}>
          <Grid item xs={12} md={10} lg={8}>
            <InfoCard title="Theme tokens (Tokens Studio JSON)">
              <CodeSnippet language="json" text={tokensJson} />
              <div className={classes.tokenActions}>
                <CopyTextButton text={tokensJson} tooltipText="Copy tokens JSON" />
              </div>
            </InfoCard>
          </Grid>

          <Grid item xs={12} md={6} lg={4}>
            <InfoCard title="Colors">
              {swatches.map(([label, value]) => (
                <div key={label} className={classes.swatchRow}>
                  <div className={classes.swatch} style={{ background: value }} />
                  <div style={{ flex: 1 }}>
                    <Typography variant="body2" className={classes.swatchLabel}>
                      {label}
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      {value}
                    </Typography>
                  </div>
                  <CopyTextButton text={value} tooltipText="Copy" />
                </div>
              ))}
            </InfoCard>
          </Grid>

          <Grid item xs={12} md={10} lg={8}>
            <InfoCard title="Typography">
              <Typography variant="h5">Heading (h5)</Typography>
              <Typography variant="body1">
                Body (body1) — The quick brown fox jumps over the lazy dog.
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Secondary (body2) — The quick brown fox jumps over the lazy dog.
              </Typography>
            </InfoCard>
          </Grid>

          <Grid item xs={12} md={10} lg={8}>
            <InfoCard title="Components">
              <Paper elevation={0} className={classes.componentBox}>
                <div className={classes.componentRow}>
                  <Button variant="contained" color="primary">
                    Primary
                  </Button>
                  <Button variant="outlined" color="primary">
                    Outlined
                  </Button>
                  <Button variant="text" color="primary">
                    Text
                  </Button>
                </div>
                <Box mt={2}>
                  <TextField
                    variant="outlined"
                    size="small"
                    label="Example input"
                    placeholder="Type here…"
                    fullWidth
                  />
                </Box>
              </Paper>
            </InfoCard>
          </Grid>
        </Grid>
      </Content>
    </Page>
  );
}

