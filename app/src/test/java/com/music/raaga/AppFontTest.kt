package com.music.raaga

import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import com.music.raaga.data.settings.AppFont
import com.music.raaga.ui.theme.SFProBold
import com.music.raaga.ui.theme.SFProDisplay
import com.music.raaga.ui.theme.previewFamilyFor
import com.music.raaga.ui.theme.typographyFor
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Test

class AppFontTest {

    @Test
    fun testAppFontEnumValues() {
        assertEquals(5, AppFont.entries.size)
        assertEquals("IOS_BOLD", AppFont.IOS_BOLD.id)
        assertEquals("SF_PRO", AppFont.SF_PRO.id)
        assertEquals("NEW_YORK", AppFont.NEW_YORK.id)
        assertEquals("SYSTEM", AppFont.SYSTEM.id)
        assertEquals("MONOSPACE", AppFont.MONOSPACE.id)
    }

    @Test
    fun testAppFontFromId() {
        // Exact id
        assertEquals(AppFont.IOS_BOLD, AppFont.fromId("IOS_BOLD"))
        assertEquals(AppFont.SF_PRO, AppFont.fromId("SF_PRO"))
        assertEquals(AppFont.NEW_YORK, AppFont.fromId("NEW_YORK"))
        assertEquals(AppFont.SYSTEM, AppFont.fromId("SYSTEM"))
        assertEquals(AppFont.MONOSPACE, AppFont.fromId("MONOSPACE"))

        // Case-insensitive / lowercase
        assertEquals(AppFont.IOS_BOLD, AppFont.fromId("ios_bold"))
        assertEquals(AppFont.SF_PRO, AppFont.fromId("sf_pro"))
        assertEquals(AppFont.NEW_YORK, AppFont.fromId("new_york"))
        assertEquals(AppFont.SYSTEM, AppFont.fromId("system"))
        assertEquals(AppFont.MONOSPACE, AppFont.fromId("monospace"))

        // Fallback for null or unknown id
        assertEquals(AppFont.SF_PRO, AppFont.fromId(null))
        assertEquals(AppFont.SF_PRO, AppFont.fromId("unknown_style"))
    }

    @Test
    fun testPreviewFamilyFor() {
        assertEquals(SFProBold, previewFamilyFor(AppFont.IOS_BOLD))
        assertEquals(SFProDisplay, previewFamilyFor(AppFont.SF_PRO))
        assertEquals(FontFamily.Serif, previewFamilyFor(AppFont.NEW_YORK))
        assertEquals(FontFamily.Default, previewFamilyFor(AppFont.SYSTEM))
        assertEquals(FontFamily.Monospace, previewFamilyFor(AppFont.MONOSPACE))
    }

    @Test
    fun testTypographyForIosBold() {
        val typo = typographyFor(AppFont.IOS_BOLD)
        assertNotNull(typo)
        assertEquals(FontWeight.W800, typo.displayLarge.fontWeight)
        assertEquals(FontWeight.W800, typo.headlineLarge.fontWeight)
        assertEquals(FontWeight.W800, typo.titleLarge.fontWeight)
        assertEquals(FontWeight.W600, typo.bodyLarge.fontWeight)
        assertEquals(FontWeight.W600, typo.bodyMedium.fontWeight)
        assertEquals(FontWeight.W700, typo.labelLarge.fontWeight)
    }

    @Test
    fun testTypographyForSfPro() {
        val typo = typographyFor(AppFont.SF_PRO)
        assertNotNull(typo)
        assertEquals(FontWeight.W800, typo.displayLarge.fontWeight)
        assertEquals(FontWeight.W700, typo.titleLarge.fontWeight)
        assertEquals(FontWeight.W400, typo.bodyLarge.fontWeight)
        assertEquals(FontWeight.W400, typo.bodyMedium.fontWeight)
        assertEquals(FontWeight.W600, typo.labelMedium.fontWeight)
    }

    @Test
    fun testTypographyForOtherStyles() {
        val serif = typographyFor(AppFont.NEW_YORK)
        assertNotNull(serif)
        val sys = typographyFor(AppFont.SYSTEM)
        assertNotNull(sys)
        val mono = typographyFor(AppFont.MONOSPACE)
        assertNotNull(mono)
    }
}
