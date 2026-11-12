package app.titlo;

import android.Manifest;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;

/**
 * Sprema izvezeni MP4 u Galeriju (Movies/Titlo), umjesto da nudi samo dijeljenje.
 * Android 10+ koristi MediaStore bez dozvola; stariji traže dozvolu za pohranu.
 */
@CapacitorPlugin(
    name = "MediaSaver",
    permissions = {
        @Permission(strings = { Manifest.permission.WRITE_EXTERNAL_STORAGE }, alias = "storage")
    }
)
public class MediaSaverPlugin extends Plugin {

    private static final String FOLDER = "Titlo";

    @PluginMethod
    public void saveVideo(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q
            && getPermissionState("storage") != PermissionState.GRANTED) {
            requestPermissionForAlias("storage", call, "storagePermissionCallback");
            return;
        }
        copyInBackground(call);
    }

    @PermissionCallback
    private void storagePermissionCallback(PluginCall call) {
        if (getPermissionState("storage") == PermissionState.GRANTED) {
            copyInBackground(call);
        } else {
            call.reject("Bez dozvole za pohranu video ne može u Galeriju.");
        }
    }

    private void copyInBackground(PluginCall call) {
        String path = call.getString("path");
        String name = call.getString("name", "titlo.mp4");
        if (path == null) {
            call.reject("Nedostaje putanja do videa.");
            return;
        }
        File source = new File(Uri.parse(path).getPath());
        if (!source.exists()) {
            call.reject("Privremeni video nije pronađen.");
            return;
        }

        new Thread(() -> {
            try {
                String location = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
                    ? saveWithMediaStore(source, name)
                    : saveToPublicFolder(source, name);
                JSObject result = new JSObject();
                result.put("location", location);
                call.resolve(result);
            } catch (Exception error) {
                call.reject("Video nije sačuvan: " + error.getMessage(), error);
            }
        }).start();
    }

    private String saveWithMediaStore(File source, String name) throws IOException {
        ContentResolver resolver = getContext().getContentResolver();
        ContentValues values = new ContentValues();
        values.put(MediaStore.Video.Media.DISPLAY_NAME, name);
        values.put(MediaStore.Video.Media.MIME_TYPE, "video/mp4");
        values.put(MediaStore.Video.Media.RELATIVE_PATH, Environment.DIRECTORY_MOVIES + "/" + FOLDER);
        values.put(MediaStore.Video.Media.IS_PENDING, 1);

        Uri collection = MediaStore.Video.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY);
        Uri item = resolver.insert(collection, values);
        if (item == null) throw new IOException("Galerija nije prihvatila fajl.");

        try (InputStream in = new FileInputStream(source);
             OutputStream out = resolver.openOutputStream(item)) {
            if (out == null) throw new IOException("Galerija nije otvorila fajl.");
            copy(in, out);
        } catch (IOException error) {
            resolver.delete(item, null, null);
            throw error;
        }

        values.clear();
        values.put(MediaStore.Video.Media.IS_PENDING, 0);
        resolver.update(item, values, null, null);
        return Environment.DIRECTORY_MOVIES + "/" + FOLDER + "/" + name;
    }

    private String saveToPublicFolder(File source, String name) throws IOException {
        File folder = new File(
            Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_MOVIES),
            FOLDER
        );
        if (!folder.exists() && !folder.mkdirs()) throw new IOException("Folder nije napravljen.");
        File target = new File(folder, name);
        try (InputStream in = new FileInputStream(source);
             OutputStream out = new FileOutputStream(target)) {
            copy(in, out);
        }
        MediaScannerConnection.scanFile(
            getContext(),
            new String[] { target.getAbsolutePath() },
            new String[] { "video/mp4" },
            null
        );
        return Environment.DIRECTORY_MOVIES + "/" + FOLDER + "/" + name;
    }

    private static void copy(InputStream in, OutputStream out) throws IOException {
        byte[] buffer = new byte[1 << 16];
        int read;
        while ((read = in.read(buffer)) != -1) {
            out.write(buffer, 0, read);
        }
        out.flush();
    }
}
