import { File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Album, Asset, requestPermissionsAsync } from 'expo-media-library';
import { Alert } from 'react-native';

export type PhotoSource = 'camera' | 'library';

// Asks whether to use the camera or the gallery
export function choosePhotoSource(title: string): Promise<PhotoSource | null> {
  return new Promise((resolve) => {
    Alert.alert(title, undefined, [
      { text: 'Take a photo', onPress: () => resolve('camera') },
      { text: 'Choose from gallery', onPress: () => resolve('library') },
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
    ], { cancelable: true, onDismiss: () => resolve(null) });
  });
}

async function pick(source: PhotoSource, square: boolean): Promise<string | null> {
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    allowsEditing: square,
    aspect: square ? [1, 1] : undefined,
    quality: 0.9,
  };
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Camera not allowed', 'You can turn on camera access for Clink in your phone settings.');
      return null;
    }
    const r = await ImagePicker.launchCameraAsync(options);
    return r.canceled ? null : (r.assets[0]?.uri ?? null);
  }
  const r = await ImagePicker.launchImageLibraryAsync(options);
  return r.canceled ? null : (r.assets[0]?.uri ?? null);
}

async function shrink(uri: string, width: number) {
  const ctx = ImageManipulator.manipulate(uri);
  ctx.resize({ width });
  const rendered = await ctx.renderAsync();
  const out = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.7, base64: true });
  return out.base64 ?? null;
}

// A child's photo: square, small enough to sync between phones in a moment
export async function pickChildPhoto(): Promise<string | null> {
  return pickSquarePhoto('Add a photo');
}

// What the child is saving for, shown on their jar
export async function pickGoalPhoto(): Promise<string | null> {
  return pickSquarePhoto('Photo of the goal');
}

async function pickSquarePhoto(title: string): Promise<string | null> {
  const source = await choosePhotoSource(title);
  if (!source) return null;
  const uri = await pick(source, true);
  return uri ? shrink(uri, 256) : null;
}

/*
 * Proof the goal was reached: the full photo is saved to the phone's gallery in a
 * "Clink" album and in the app's own storage. A small copy is kept for the app
 * screens and shared with the other parent's phone.
 */
export async function takeGoalPhoto(goalId: string): Promise<{ thumb: string; uri: string | null } | null> {
  const source = await choosePhotoSource('Photo of the goal');
  if (!source) return null;
  const uri = await pick(source, false);
  if (!uri) return null;

  const thumb = await shrink(uri, 640);
  if (!thumb) return null;

  let kept: string | null = null;
  try {
    const dest = new File(Paths.document, `goal-${goalId}-${Date.now()}.jpg`);
    await new File(uri).copy(dest);
    kept = dest.uri;
  } catch {
    kept = null;
  }

  if (source === 'camera') await saveToGallery(kept ?? uri);
  return { thumb, uri: kept };
}

async function saveToGallery(uri: string) {
  try {
    const { granted } = await requestPermissionsAsync(true);
    if (!granted) return;
    const album = await Album.get('Clink');
    const asset = await Asset.create(uri, album ?? undefined);
    if (!album) await Album.create('Clink', [asset]);
  } catch {
    // Saving to the gallery is a bonus. The photo is still kept in the app.
  }
}

export function photoSource(base64: string | null) {
  return base64 ? { uri: `data:image/jpeg;base64,${base64}` } : null;
}
