package com.music.raaga.data.connect

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.util.UUID
import java.util.prefs.Preferences

/**
 * Persistent store for Raaga Connect device identity and paired devices on Desktop.
 * Persists data to OS user preferences (Registry on Windows) until the user explicitly deletes a device.
 */
object RaagaPairingStore {
    private val prefs = Preferences.userRoot().node("com.music.raaga.connect")
    private val json = Json {
        ignoreUnknownKeys = true
        encodeDefaults = true
        isLenient = true
    }

    private const val KEY_DEVICE_ID = "connect_device_id"
    private const val KEY_PAIRED_DEVICES = "paired_devices_json"

    val deviceId: String = synchronized(this) {
        val existing = prefs.get(KEY_DEVICE_ID, null)
        if (!existing.isNullOrBlank()) {
            existing
        } else {
            val newId = UUID.randomUUID().toString()
            prefs.put(KEY_DEVICE_ID, newId)
            runCatching { prefs.flush() }
            newId
        }
    }

    private val _pairedDevices = MutableStateFlow<List<PairedDevice>>(loadPairedDevices())
    val pairedDevices: StateFlow<List<PairedDevice>> = _pairedDevices.asStateFlow()

    private fun loadPairedDevices(): List<PairedDevice> {
        val raw = prefs.get(KEY_PAIRED_DEVICES, null) ?: return emptyList()
        return runCatching {
            json.decodeFromString<List<PairedDevice>>(raw)
        }.getOrDefault(emptyList())
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

    private const val KEY_CUSTOM_DEVICE_NAME = "custom_device_name"

    fun getCustomDeviceName(): String? = prefs.get(KEY_CUSTOM_DEVICE_NAME, null)?.takeIf(String::isNotBlank)

    @Synchronized
    fun saveCustomDeviceName(name: String?) {
        if (name.isNullOrBlank()) {
            prefs.remove(KEY_CUSTOM_DEVICE_NAME)
        } else {
            prefs.put(KEY_CUSTOM_DEVICE_NAME, name.trim())
        }
        runCatching { prefs.flush() }
    }

    private fun save(list: List<PairedDevice>) {
        _pairedDevices.value = list
        runCatching {
            prefs.put(KEY_PAIRED_DEVICES, json.encodeToString(list))
            prefs.flush()
        }
    }
}
