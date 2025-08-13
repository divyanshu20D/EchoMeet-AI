import { getPrismaClient } from '../utils/database.js';

class MeetingService {
    constructor() {
        this.prisma = null;
    }

    getPrisma() {
        if (!this.prisma) {
            this.prisma = getPrismaClient();
        }
        return this.prisma;
    }

    async createMeeting(hostId, meetingData) {
        const { title, description, scheduledAt, settings } = meetingData;

        // Normalize scheduledAt to proper Date object
        let normalizedScheduledAt = null;
        if (scheduledAt) {
            // Handle datetime-local format (YYYY-MM-DDTHH:mm) by adding seconds
            const dateStr = scheduledAt.includes(':') && scheduledAt.split(':').length === 2
                ? `${scheduledAt}:00`
                : scheduledAt;
            normalizedScheduledAt = new Date(dateStr);
        }

        const meeting = await this.getPrisma().meeting.create({
            data: {
                title,
                description,
                hostId,
                organizationId: null, // Will be set based on user's organization
                scheduledAt: normalizedScheduledAt,
                settings: settings || {
                    isPublic: false,
                    requirePassword: false,
                    waitingRoomEnabled: false,
                    recordingEnabled: false,
                    maxParticipants: 100,
                    allowScreenShare: true,
                    allowChat: true,
                    muteParticipantsOnJoin: false
                }
            },
            include: {
                host: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                }
            }
        });

        return meeting;
    }

    async getUserMeetings(userId, pagination) {
        const { page, limit, sortBy = 'createdAt', sortOrder = 'desc' } = pagination;
        const skip = (page - 1) * limit;

        const [meetings, total] = await Promise.all([
            this.getPrisma().meeting.findMany({
                where: {
                    OR: [
                        { hostId: userId },
                        {
                            participants: {
                                some: {
                                    userId: userId
                                }
                            }
                        }
                    ]
                },
                include: {
                    host: {
                        select: {
                            id: true,
                            name: true,
                            email: true
                        }
                    },
                    participants: {
                        select: {
                            id: true,
                            userId: true,
                            role: true,
                            joinedAt: true,
                            leftAt: true,
                            user: {
                                select: {
                                    name: true,
                                    email: true
                                }
                            }
                        }
                    },
                    _count: {
                        select: {
                            participants: true,
                            recordings: true
                        }
                    }
                },
                orderBy: {
                    [sortBy]: sortOrder
                },
                skip,
                take: limit
            }),
            this.getPrisma().meeting.count({
                where: {
                    OR: [
                        { hostId: userId },
                        {
                            participants: {
                                some: {
                                    userId: userId
                                }
                            }
                        }
                    ]
                }
            })
        ]);

        return {
            meetings,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        };
    }

    async getMeetingById(meetingId, userId = null) {
        const meeting = await this.getPrisma().meeting.findUnique({
            where: { id: meetingId },
            include: {
                host: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                },
                participants: {
                    where: {
                        leftAt: null // Only active participants
                    },
                    select: {
                        id: true,
                        userId: true,
                        role: true,
                        joinedAt: true,
                        isAudioMuted: true,
                        isVideoMuted: true,
                        isScreenSharing: true,
                        user: {
                            select: {
                                name: true,
                                email: true,
                                avatar: true
                            }
                        }
                    }
                },
                _count: {
                    select: {
                        participants: true,
                        recordings: true
                    }
                }
            }
        });

        if (!meeting) {
            throw new Error('MEETING_NOT_FOUND');
        }

        // Check if meeting is public or user has access
        const hasAccess = meeting.settings?.isPublic ||
            (userId && (meeting.hostId === userId ||
                meeting.organizationId === userId)); // This should check user's organizationId

        if (!hasAccess && userId) {
            throw new Error('ACCESS_DENIED');
        }

        return meeting;
    }

    async updateMeeting(meetingId, hostId, updateData) {
        // Check if user is the host
        const meeting = await this.getPrisma().meeting.findUnique({
            where: { id: meetingId }
        });

        if (!meeting) {
            throw new Error('MEETING_NOT_FOUND');
        }

        if (meeting.hostId !== hostId) {
            throw new Error('ACCESS_DENIED');
        }

        // Prepare update data
        const updatePayload = {
            ...updateData,
            scheduledAt: updateData.scheduledAt ? new Date(updateData.scheduledAt) : undefined
        };

        const updatedMeeting = await this.getPrisma().meeting.update({
            where: { id: meetingId },
            data: updatePayload,
            include: {
                host: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                }
            }
        });

        return updatedMeeting;
    }

    async deleteMeeting(meetingId, hostId) {
        // Check if user is the host
        const meeting = await this.getPrisma().meeting.findUnique({
            where: { id: meetingId }
        });

        if (!meeting) {
            throw new Error('MEETING_NOT_FOUND');
        }

        if (meeting.hostId !== hostId) {
            throw new Error('ACCESS_DENIED');
        }

        // Delete meeting (cascade will handle related records)
        await this.getPrisma().meeting.delete({
            where: { id: meetingId }
        });
    }

    async startMeeting(meetingId, hostId) {
        const meeting = await this.getPrisma().meeting.findUnique({
            where: { id: meetingId }
        });

        if (!meeting) {
            throw new Error('MEETING_NOT_FOUND');
        }

        if (meeting.hostId !== hostId) {
            throw new Error('ACCESS_DENIED');
        }

        if (meeting.status === 'ACTIVE') {
            throw new Error('MEETING_ALREADY_ACTIVE');
        }

        const updatedMeeting = await this.getPrisma().meeting.update({
            where: { id: meetingId },
            data: {
                status: 'ACTIVE',
                startedAt: new Date()
            }
        });

        return updatedMeeting;
    }

    async endMeeting(meetingId, hostId) {
        const meeting = await this.getPrisma().meeting.findUnique({
            where: { id: meetingId }
        });

        if (!meeting) {
            throw new Error('MEETING_NOT_FOUND');
        }

        if (meeting.hostId !== hostId) {
            throw new Error('ACCESS_DENIED');
        }

        if (meeting.status === 'ENDED') {
            throw new Error('MEETING_ALREADY_ENDED');
        }

        // Calculate duration if meeting was started
        let duration = null;
        if (meeting.startedAt) {
            duration = Math.floor((new Date() - meeting.startedAt) / 1000 / 60); // in minutes
        }

        const updatedMeeting = await this.getPrisma().meeting.update({
            where: { id: meetingId },
            data: {
                status: 'ENDED',
                endedAt: new Date(),
                duration
            }
        });

        // Update all active participants to mark them as left
        await this.getPrisma().participant.updateMany({
            where: {
                meetingId,
                leftAt: null
            },
            data: {
                leftAt: new Date()
            }
        });

        return updatedMeeting;
    }

    async getMeetingInfo(meetingId) {
        const meeting = await this.getPrisma().meeting.findUnique({
            where: { id: meetingId },
            select: {
                id: true,
                title: true,
                description: true,
                status: true,
                scheduledAt: true,
                settings: true,
                host: {
                    select: {
                        name: true
                    }
                },
                _count: {
                    select: {
                        participants: {
                            where: {
                                leftAt: null // Only active participants
                            }
                        }
                    }
                }
            }
        });

        if (!meeting) {
            throw new Error('MEETING_NOT_FOUND');
        }

        return {
            id: meeting.id,
            title: meeting.title,
            description: meeting.description,
            status: meeting.status,
            scheduledAt: meeting.scheduledAt,
            hostName: meeting.host.name,
            participantCount: meeting._count.participants,
            isPasswordProtected: meeting.settings?.requirePassword || false,
            isSecure: meeting.settings?.requirePassword || meeting.settings?.waitingRoomEnabled || false
        };
    }

    async validateMeetingAccess(meetingId, password, userId = null, guestName = null) {
        const meeting = await this.getPrisma().meeting.findUnique({
            where: { id: meetingId },
            select: {
                id: true,
                title: true,
                status: true,
                hostId: true,
                settings: true,
                host: {
                    select: {
                        name: true
                    }
                }
            }
        });

        if (!meeting) {
            throw new Error('MEETING_NOT_FOUND');
        }

        // Check if meeting has ended
        if (meeting.status === 'ENDED') {
            throw new Error('MEETING_ENDED');
        }

        // Check password if required
        if (meeting.settings?.requirePassword && meeting.settings?.password) {
            if (!password || password !== meeting.settings.password) {
                throw new Error('INVALID_PASSWORD');
            }
        }

        // For authenticated users, check if they're the host
        const isHost = userId && meeting.hostId === userId;

        return {
            meetingId: meeting.id,
            title: meeting.title,
            hostName: meeting.host.name,
            isHost,
            canJoin: true,
            guestName: !userId ? guestName : null
        };
    }

    async joinMeeting(meetingId, userId) {
        const meeting = await this.getPrisma().meeting.findUnique({
            where: { id: meetingId },
            select: {
                id: true,
                title: true,
                status: true,
                hostId: true,
                settings: true
            }
        });

        if (!meeting) {
            throw new Error('MEETING_NOT_FOUND');
        }

        if (meeting.status === 'ENDED') {
            throw new Error('MEETING_ENDED');
        }

        // Start the meeting if it's not started and user is the host
        if (meeting.status === 'SCHEDULED' && meeting.hostId === userId) {
            await this.getPrisma().meeting.update({
                where: { id: meetingId },
                data: {
                    status: 'ACTIVE',
                    startedAt: new Date()
                }
            });
        }

        // Create or update participant record
        const participant = await this.getPrisma().participant.upsert({
            where: {
                userId_meetingId: {
                    userId,
                    meetingId
                }
            },
            update: {
                leftAt: null, // Mark as rejoined
                joinedAt: new Date()
            },
            create: {
                userId,
                meetingId,
                role: meeting.hostId === userId ? 'HOST' : 'PARTICIPANT',
                joinedAt: new Date()
            },
            include: {
                user: {
                    select: {
                        name: true,
                        email: true,
                        avatar: true
                    }
                }
            }
        });

        return {
            meetingId,
            participant,
            isHost: meeting.hostId === userId
        };
    }

    async leaveMeeting(meetingId, userId) {
        // Update participant record to mark as left
        await this.getPrisma().participant.updateMany({
            where: {
                meetingId,
                userId,
                leftAt: null
            },
            data: {
                leftAt: new Date()
            }
        });

        return { success: true };
    }

    async getMeetingParticipants(meetingId) {
        const participants = await this.getPrisma().participant.findMany({
            where: {
                meetingId,
                leftAt: null // Only active participants
            },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        avatar: true
                    }
                }
            },
            orderBy: {
                joinedAt: 'asc'
            }
        });

        return participants.map(participant => ({
            id: participant.id,
            userId: participant.userId,
            name: participant.user.name,
            email: participant.user.email,
            avatar: participant.user.avatar,
            role: participant.role,
            joinedAt: participant.joinedAt,
            isAudioMuted: participant.isAudioMuted,
            isVideoMuted: participant.isVideoMuted,
            isScreenSharing: participant.isScreenSharing
        }));
    }
}

export default new MeetingService();
