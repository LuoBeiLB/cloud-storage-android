package com.cloudstorage.app

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.FileProvider
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import java.io.File

@CapacitorPlugin(name = "AppUpdate")
class AppUpdatePlugin : Plugin() {

    // 检查 Android 8+ "安装未知应用"授权状态
    @PluginMethod
    fun canInstall(call: PluginCall) {
        val ret = JSObject()
        ret.put("value", if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
            context.packageManager.canRequestPackageInstalls() else true)
        call.resolve(ret)
    }

    // 跳转系统设置页，引导用户开启"允许安装未知应用"
    @PluginMethod
    fun openInstallSetting(call: PluginCall) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val intent = Intent(
                Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                Uri.fromParts("package", context.packageName, null)
            ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(intent)
        }
        call.resolve()
    }

    // 通过 FileProvider 调起系统安装器
    // path 传文件系统绝对路径（如 /data/user/0/包名/files/updates/xxx.apk）
    @PluginMethod
    fun install(call: PluginCall) {
        val path = call.getString("path")
        if (path.isNullOrEmpty()) { call.reject("path required"); return }
        val file = File(Uri.parse(path).path)
        if (!file.exists()) { call.reject("file not found: $path"); return }

        val uri = FileProvider.getUriForFile(
            context, context.packageName + ".fileprovider", file
        )
        val intent = Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(uri, "application/vnd.android.package-archive")
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(intent)
        call.resolve()
    }
}
