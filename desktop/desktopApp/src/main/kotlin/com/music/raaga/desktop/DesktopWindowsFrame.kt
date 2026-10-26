package com.music.raaga.desktop

import com.sun.jna.Library
import com.sun.jna.Memory
import com.sun.jna.Native
import com.sun.jna.Pointer
import com.sun.jna.Structure
import java.awt.Window

/**
 * Windows' native frame and DWM backdrop bridge via Win32 and JNA.
 *
 * Provides native Acrylic, Mica and window controls on Windows 11 without requiring
 * external precompiled C++ DLLs.
 */
internal object DesktopWindowsFrame {

    @Structure.FieldOrder("cxLeftWidth", "cxRightWidth", "cyTopHeight", "cyBottomHeight")
    class MARGINS : Structure {
        @JvmField var cxLeftWidth: Int = 0
        @JvmField var cxRightWidth: Int = 0
        @JvmField var cyTopHeight: Int = 0
        @JvmField var cyBottomHeight: Int = 0

        constructor() : super()
        constructor(all: Int) : super() {
            cxLeftWidth = all
            cxRightWidth = all
            cyTopHeight = all
            cyBottomHeight = all
        }
    }

    private interface LibDwmapi : Library {
        fun DwmSetWindowAttribute(hwnd: Pointer, dwAttribute: Int, pvAttribute: Pointer, cbAttribute: Int): Int
        fun DwmExtendFrameIntoClientArea(hwnd: Pointer, pMarInset: MARGINS): Int
    }

    private interface LibUser32 : Library {
        fun FindWindowW(lpClassName: String?, lpWindowName: String?): Pointer?
        fun ShowWindow(hwnd: Pointer, nCmdShow: Int): Boolean
        fun IsZoomed(hwnd: Pointer): Boolean
        fun ReleaseCapture(): Boolean
        fun SendMessageW(hwnd: Pointer, msg: Int, wParam: Long, lParam: Long): Long
        fun PostMessageW(hwnd: Pointer, msg: Int, wParam: Long, lParam: Long): Boolean
        fun GetWindowLongW(hwnd: Pointer, nIndex: Int): Int
        fun SetWindowLongW(hwnd: Pointer, nIndex: Int, dwNewLong: Int): Int
        fun SetWindowPos(hwnd: Pointer, hWndInsertAfter: Pointer?, x: Int, y: Int, cx: Int, cy: Int, uFlags: Int): Boolean
    }

    private const val GWL_STYLE = -16
    private const val WS_THICKFRAME = 0x00040000
    private const val WS_MINIMIZEBOX = 0x00020000
    private const val WS_MAXIMIZEBOX = 0x00010000
    private const val WS_SYSMENU = 0x00080000

    private const val SWP_NOMOVE = 0x0002
    private const val SWP_NOSIZE = 0x0001
    private const val SWP_NOZORDER = 0x0004
    private const val SWP_FRAMECHANGED = 0x0020

    private val dwmapi: LibDwmapi? by lazy {
        if (!DesktopPlatform.isWindows) null
        else runCatching { Native.load("dwmapi", LibDwmapi::class.java) }.getOrNull()
    }

    private val user32: LibUser32? by lazy {
        if (!DesktopPlatform.isWindows) null
        else runCatching { Native.load("user32", LibUser32::class.java) }.getOrNull()
    }

    @Volatile
    private var windowPointer: Pointer? = null

    @Volatile
    private var installed = false

    fun install(window: Window): Boolean {
        if (!DesktopPlatform.isWindows) return false
        val hwnd = runCatching {
            Native.getWindowPointer(window) ?: Native.getComponentPointer(window)
        }.getOrNull()
        if (hwnd != null) {
            windowPointer = hwnd
            installed = true
            applyInitialWindowAttributes(hwnd)
            return true
        }
        return false
    }

    suspend fun install(title: String): Boolean {
        if (!DesktopPlatform.isWindows) return false
        if (installed && windowPointer != null) return true
        val u = user32 ?: return false
        repeat(INSTALL_ATTEMPTS) {
            val hwnd = runCatching { u.FindWindowW(null, title) }.getOrNull()
            if (hwnd != null) {
                windowPointer = hwnd
                installed = true
                applyInitialWindowAttributes(hwnd)
                return true
            }
            kotlinx.coroutines.delay(INSTALL_RETRY_MILLIS)
        }
        return false
    }

    private fun applyInitialWindowAttributes(hwnd: Pointer) {
        val d = dwmapi ?: return
        val u = user32

        // Enable Dark Mode (DWMWA_USE_IMMERSIVE_DARK_MODE = 20)
        val darkMem = Memory(4).apply { setInt(0, 1) }
        d.DwmSetWindowAttribute(hwnd, 20, darkMem, 4)

        // Rounded corners (DWMWA_WINDOW_CORNER_PREFERENCE = 33, 2 = DWMWCP_ROUND)
        val cornerMem = Memory(4).apply { setInt(0, 2) }
        d.DwmSetWindowAttribute(hwnd, 33, cornerMem, 4)

        // Make window taskbar-aware: WS_THICKFRAME and WS_MAXIMIZEBOX ensure Windows OS
        // constrains maximized bounds to the Taskbar Work Area (rcWork), so the Taskbar
        // is never covered or hidden when maximized.
        if (u != null) {
            runCatching {
                val currentStyle = u.GetWindowLongW(hwnd, GWL_STYLE)
                val newStyle = currentStyle or WS_THICKFRAME or WS_MINIMIZEBOX or WS_MAXIMIZEBOX or WS_SYSMENU
                if (newStyle != currentStyle) {
                    u.SetWindowLongW(hwnd, GWL_STYLE, newStyle)
                    u.SetWindowPos(
                        hwnd,
                        null,
                        0, 0, 0, 0,
                        SWP_NOMOVE or SWP_NOSIZE or SWP_NOZORDER or SWP_FRAMECHANGED
                    )
                }
            }
        }
    }

    fun minimize(): Boolean {
        val hwnd = windowPointer ?: return false
        val u = user32 ?: return false
        return runCatching { u.ShowWindow(hwnd, 6 /* SW_MINIMIZE */) }.getOrDefault(false)
    }

    fun toggleMaximize(): Boolean {
        val hwnd = windowPointer ?: return false
        val u = user32 ?: return false
        return runCatching {
            val isZoomed = u.IsZoomed(hwnd)
            u.ShowWindow(hwnd, if (isZoomed) 9 /* SW_RESTORE */ else 3 /* SW_MAXIMIZE */)
        }.getOrDefault(false)
    }

    fun startDrag(): Boolean {
        val hwnd = windowPointer ?: return false
        val u = user32 ?: return false
        return runCatching {
            u.ReleaseCapture()
            u.PostMessageW(hwnd, 0x0112 /* WM_SYSCOMMAND */, 0xF012 /* SC_MOVE | HTCAPTION */, 0)
        }.getOrDefault(false)
    }

    fun setBackdrop(kind: Int): Boolean {
        val hwnd = windowPointer ?: return false
        val d = dwmapi ?: return false
        return runCatching {
            // Dark mode (DWMWA_USE_IMMERSIVE_DARK_MODE = 20)
            val darkMem = Memory(4).apply { setInt(0, 1) }
            d.DwmSetWindowAttribute(hwnd, 20, darkMem, 4)

            // DWMWA_SYSTEMBACKDROP_TYPE = 38
            // 2: Mica, 3: Acrylic, 4: Mica Alt, 1: None
            val material = kind == 2 || kind == 3 || kind == 4
            val typeVal = if (material) kind else 1 /* DWMSBT_NONE */
            val typeMem = Memory(4).apply { setInt(0, typeVal) }
            val res = d.DwmSetWindowAttribute(hwnd, 38, typeMem, 4)

            val margins = MARGINS(if (material) -1 else 1)
            d.DwmExtendFrameIntoClientArea(hwnd, margins)
            res == 0
        }.getOrDefault(false)
    }

    private const val INSTALL_ATTEMPTS = 20
    private const val INSTALL_RETRY_MILLIS = 100L
}
