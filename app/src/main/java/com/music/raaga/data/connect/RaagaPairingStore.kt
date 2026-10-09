package com.music.raaga.data.connect

import android.content.Context
import android.content.SharedPreferences
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.util.UUID

/**
 * Persistent store for Raaga Connect device identity and paired devices on Android.
 * Persists data to SharedPreferences until the user explicitly deletes a device.
 */
object RaagaPairingStore {
    private const val PREFS_NAME = "raaga_connect_prefs"
    private const val KEY_DEVICE_ID = "connect_device_id"
    private const val KEY_PAIRED_DEVICES = "paired_devices_json"
    private const val KEY_CUSTOM_DEVICE_NAME = "custom_device_name"

    private val json = Json {
        ignoreUnknownKeys = true
        encodeDefaults = true
        isLenient = true
    }

    private var prefs: SharedPreferences? = null
    private var _cachedDeviceId: String? = null

    private val _pairedDevices = MutableStateFlow<List<PairedDevice>>(emptyList())
    val pairedDevices: StateFlow<List<PairedDevice>> = _pairedDevices.asStateFlow()

    fun init(context: Context) {
        if (prefs == null) {
            val sp = context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            prefs = sp
            // Ensure stable device id
            var id = sp.getString(KEY_DEVICE_ID, null)
            if (id.isNullOrBlank()) {
                id = UUID.randomUUID().toString()
                sp.edit().putString(KEY_DEVICE_ID, id).apply()
            }
            _cachedDeviceId = id
            loadFromPrefs(sp)
        }
    }

    val deviceId: String
        get() {
            if (_cachedDeviceId != null) return _cachedDeviceId!!
            val sp = prefs
            if (sp != null) {
                var id = sp.getString(KEY_DEVICE_ID, null)
                if (id.isNullOrBlank()) {
                    id = UUID.randomUUID().toString()
                    sp.edit().putString(KEY_DEVICE_ID, id).apply()
                }
                _cachedDeviceId = id
                return id
            }
            val fallback = UUID.randomUUID().toString()
            _cachedDeviceId = fallback
            return fallback
        }

    private fun loadFromPrefs(sp: SharedPreferences) {
        val raw = sp.getString(KEY_PAIRED_DEVICES, null) ?: return
        val list = runCatching {
            json.decodeFromString<List<PairedDevice>>(raw)
        }.getOrDefault(emptyList())
        _pairedDevices.value = list
    }

    @Synchronized
    fun addPairedDevice(device: PairedDevice) {
        val filtered = _pairedDevices.value.filter { it.id != device.id }
        val updated = filtered + device
        save(updated)
    }

    @Synchronized
    fun removePairedDevice(deviceId: String) {
        val updated = _pairedDevices.value.filter { it.id != deviceId }
        save(updated)
    }

    fun isPaired(deviceId: String): Boolean {
        return _pairedDevices.value.any { it.id == deviceId }
    }

    fun getCustomDeviceName(): String? {
        return prefs?.getString(KEY_CUSTOM_DEVICE_NAME, null)
    }

    fun saveCustomDeviceName(name: String) {
        prefs?.edit()?.putString(KEY_CUSTOM_DEVICE_NAME, name)?.apply()
    }

    private const val KEY_SYNC_KEY = "connect_sync_key"

    fun getSyncKey(): String? {
        return prefs?.getString(KEY_SYNC_KEY, null)?.takeIf { it.isNotBlank() }
    }

    @Synchronized
    fun saveSyncKey(key: String?) {
        if (key.isNullOrBlank()) {
            prefs?.edit()?.remove(KEY_SYNC_KEY)?.apply()
        } else {
            prefs?.edit()?.putString(KEY_SYNC_KEY, key.trim())?.apply()
        }
    }

    private fun save(list: List<PairedDevice>) {
        _pairedDevices.value = list
        prefs?.edit()?.putString(KEY_PAIRED_DEVICES, json.encodeToString(list))?.apply()
    }
}
