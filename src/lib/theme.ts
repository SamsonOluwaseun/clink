// Samlytics Data Services brand palette
export const colors = {
  blue: '#4392F1', // primary brand blue
  blueDark: '#1F6FD1', // darker blue for text on cream, so it stays readable
  blueSoft: '#E3EFFD',
  lime: '#DCFF38', // coins and the main reward button
  limeDeep: '#C2E812',
  limeSoft: '#F4FFC7',
  navy: '#00212B', // brand black
  ink: '#1C3A44',
  muted: '#4F6670',
  cream: '#FEFFF8',
  card: '#FFFFFF',
  line: '#E4E9E3',
  danger: '#B42318',
  school: '#00212B',
  schoolSoft: '#E3E9EB',
};

export const fonts = {
  regular: 'Montserrat_400Regular',
  medium: 'Montserrat_500Medium',
  semibold: 'Montserrat_600SemiBold',
  bold: 'Montserrat_700Bold',
};

// Avatar colours a parent can pick for each child
export const avatarColours = ['#4392F1', '#00212B', '#DCFF38', '#1F6FD1', '#C2E812', '#5B7A85'];

// Navy text on light colours (lime), white text on dark ones (blue, navy)
export function textOn(bg: string) {
  const hex = bg.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.6 ? colors.navy : '#FFFFFF';
}

export const radius = { sm: 12, md: 18, lg: 26 };
