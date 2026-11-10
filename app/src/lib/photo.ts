import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

export type Photo = { uri: string; base64: string };

/**
 * Shrinks a captured photo to what the assistant needs (768px JPEG) and keeps a copy in the
 * app's documents, so the thumbnail in a saved chat still opens after the cache is cleared.
 */
export async function preparePhoto(uri: string): Promise<Photo | undefined> {
  try {
    const ref = await ImageManipulator.manipulate(uri).resize({ width: 768 }).renderAsync();
    const out = await ref.saveAsync({ base64: true, compress: 0.6, format: SaveFormat.JPEG });
    if (!out.base64) return undefined;
    let keep = out.uri;
    try {
      const dir = new Directory(Paths.document, 'chat-photos');
      if (!dir.exists) dir.create();
      const dest = new File(dir, `${Date.now().toString(36)}.jpg`);
      new File(out.uri).copy(dest);
      keep = dest.uri;
    } catch {
      // The cache copy still works for this session.
    }
    return { uri: keep, base64: out.base64 };
  } catch (e) {
    console.warn('photo prepare failed', e);
    return undefined;
  }
}
