package com.music.raaga.connect

import com.music.raaga.data.connect.ConnectDevice
import com.music.raaga.data.connect.ConnectDeviceType
import com.music.raaga.data.connect.RaagaSupabaseRelay
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ConnectScopeIsolationTest {

    private fun createDummyDevice(id: String, name: String) = ConnectDevice(
        id = id,
        name = name,
        type = ConnectDeviceType.PHONE,
    )

    @Test
    fun testSameAccount_computesIdenticalChannel() {
        val accountId = "google_user_1092837465"
        val phoneRelay = RaagaSupabaseRelay(
            localDeviceProvider = { createDummyDevice("dev_phone", "Pixel 8") },
            accountIdProvider = { accountId },
            onTransferReceived = {},
            onControlReceived = {},
            onStatusReceived = {},
        )
        val pcRelay = RaagaSupabaseRelay(
            localDeviceProvider = { createDummyDevice("dev_pc", "Desktop PC") },
            accountIdProvider = { accountId },
            onTransferReceived = {},
            onControlReceived = {},
            onStatusReceived = {},
        )

        val phoneChannel = phoneRelay.computeCurrentChannel()
        val pcChannel = pcRelay.computeCurrentChannel()

        assertNotNull(phoneChannel)
        assertNotNull(pcChannel)
        assertTrue(phoneChannel!!.startsWith("raaga_acc_"))
        assertEquals("Both devices with the same account must join the exact same channel", phoneChannel, pcChannel)
    }

    @Test
    fun testDifferentAccount_isIsolatedFromStranger() {
        val myAccount = "my_private_google_id_111"
        val strangerAccount = "stranger_in_tokyo_999"

        val myRelay = RaagaSupabaseRelay(
            localDeviceProvider = { createDummyDevice("my_phone", "My Phone") },
            accountIdProvider = { myAccount },
            onTransferReceived = {},
            onControlReceived = {},
            onStatusReceived = {},
        )
        val strangerRelay = RaagaSupabaseRelay(
            localDeviceProvider = { createDummyDevice("stranger_pc", "Stranger Laptop") },
            accountIdProvider = { strangerAccount },
            onTransferReceived = {},
            onControlReceived = {},
            onStatusReceived = {},
        )

        val myChannel = myRelay.computeCurrentChannel()
        val strangerChannel = strangerRelay.computeCurrentChannel()

        assertNotNull(myChannel)
        assertNotNull(strangerChannel)
        assertNotEquals("Devices on different accounts must be in completely separate rooms", myChannel, strangerChannel)
    }

    @Test
    fun testGuestUser_channelIsNull_safelyIdle() {
        val guestRelay = RaagaSupabaseRelay(
            localDeviceProvider = { createDummyDevice("guest_dev", "Guest Device") },
            accountIdProvider = { null },
            syncKeyProvider = { null },
            onTransferReceived = {},
            onControlReceived = {},
            onStatusReceived = {},
        )

        // Without an account or sync key, cloud channel must be null so it does not broadcast to strangers
        assertNull("Unauthenticated guest must not connect to any public lobby", guestRelay.computeCurrentChannel())
    }

    @Test
    fun testTemporaryPairCode_scopesToPairChannel() {
        val relay = RaagaSupabaseRelay(
            localDeviceProvider = { createDummyDevice("dev_1", "My Phone") },
            accountIdProvider = { null },
            onTransferReceived = {},
            onControlReceived = {},
            onStatusReceived = {},
        )

        assertNull(relay.computeCurrentChannel())

        relay.setTemporaryPairCode("842195")
        assertEquals("raaga_pair_842195", relay.computeCurrentChannel())

        // Clearing code returns to null (or account channel)
        relay.setTemporaryPairCode(null)
        assertNull(relay.computeCurrentChannel())
    }

    @Test
    fun testSyncKey_scopesToPrivateSyncChannel() {
        val sharedSyncKey = "7c9e6679-7425-40de-944b-e07fc1f90ae7"

        val deviceA = RaagaSupabaseRelay(
            localDeviceProvider = { createDummyDevice("dev_a", "Phone A") },
            accountIdProvider = { null },
            syncKeyProvider = { sharedSyncKey },
            onTransferReceived = {},
            onControlReceived = {},
            onStatusReceived = {},
        )
        val deviceB = RaagaSupabaseRelay(
            localDeviceProvider = { createDummyDevice("dev_b", "PC B") },
            accountIdProvider = { null },
            syncKeyProvider = { sharedSyncKey },
            onTransferReceived = {},
            onControlReceived = {},
            onStatusReceived = {},
        )

        val chanA = deviceA.computeCurrentChannel()
        val chanB = deviceB.computeCurrentChannel()

        assertNotNull(chanA)
        assertTrue(chanA!!.startsWith("raaga_sync_"))
        assertEquals("Both devices paired via syncKey must join the same sync channel", chanA, chanB)
    }

    @Test
    fun testMultiChannel_includesPairCodeAndSyncKey() {
        val relay = RaagaSupabaseRelay(
            localDeviceProvider = { createDummyDevice("dev_mc", "Multi Device") },
            accountIdProvider = { "google_user_999" },
            syncKeyProvider = { "sync_key_888" },
            onTransferReceived = {},
            onControlReceived = {},
            onStatusReceived = {},
        )

        relay.setTemporaryPairCode("123456")
        val active = relay.computeActiveChannels()

        assertTrue(active.contains("raaga_pair_123456"))
        assertTrue(active.any { it.startsWith("raaga_acc_") })
        assertTrue(active.any { it.startsWith("raaga_sync_") })
        assertEquals(3, active.size)

        relay.setTemporaryPairCode(null)
        val cleared = relay.computeActiveChannels()
        assertTrue(!cleared.contains("raaga_pair_123456"))
        assertEquals(2, cleared.size)
    }
}
