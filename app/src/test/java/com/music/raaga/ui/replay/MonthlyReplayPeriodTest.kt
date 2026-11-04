package com.music.raaga.ui.replay

import androidx.compose.runtime.saveable.SaverScope
import com.music.raaga.data.stats.ReplayPeriod
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDate
import java.time.YearMonth

class MonthlyReplayPeriodTest {

    private val oct2026 = YearMonth.of(2026, 10)
    private val nov2026 = YearMonth.of(2026, 11)
    private val today = LocalDate.of(2026, 11, 4)
    private val saverScope = SaverScope { true }

    @Test
    fun testMonthPeriodCoversOnlyTargetMonth() {
        val periodOct = ReplayPeriod.MONTH(oct2026)
        val periodNov = ReplayPeriod.MONTH(nov2026)

        assertTrue(periodOct.covers(oct2026, today))
        assertFalse(periodOct.covers(nov2026, today))

        assertTrue(periodNov.covers(nov2026, today))
        assertFalse(periodNov.covers(oct2026, today))
    }

    @Test
    fun testThisYearCoversAllMonthsInYear() {
        val periodYear = ReplayPeriod.THIS_YEAR
        assertTrue(periodYear.covers(oct2026, today))
        assertTrue(periodYear.covers(nov2026, today))
        assertFalse(periodYear.covers(YearMonth.of(2025, 10), today))
    }

    @Test
    fun testAllTimeCoversEverything() {
        val periodAllTime = ReplayPeriod.ALL_TIME
        assertTrue(periodAllTime.covers(oct2026, today))
        assertTrue(periodAllTime.covers(YearMonth.of(2024, 1), today))
    }

    @Test
    fun testMonthLabelFormatting() {
        val periodOct = ReplayPeriod.MONTH(oct2026)
        assertEquals("October 2026", periodOct.label(today))
    }

    @Test
    fun testReplayPeriodSaverRestoresAccurately() {
        val periodOct = ReplayPeriod.MONTH(oct2026)
        val saved = with(ReplayPeriodSaver) { saverScope.save(periodOct) }!!
        val restored = ReplayPeriodSaver.restore(saved)

        assertEquals(periodOct, restored)
        assertEquals(oct2026, (restored as ReplayPeriod.MONTH).yearMonth)

        val yearSaved = with(ReplayPeriodSaver) { saverScope.save(ReplayPeriod.THIS_YEAR) }!!
        assertEquals(ReplayPeriod.THIS_YEAR, ReplayPeriodSaver.restore(yearSaved))

        val allTimeSaved = with(ReplayPeriodSaver) { saverScope.save(ReplayPeriod.ALL_TIME) }!!
        assertEquals(ReplayPeriod.ALL_TIME, ReplayPeriodSaver.restore(allTimeSaved))
    }
}
