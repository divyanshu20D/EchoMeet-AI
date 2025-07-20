const { getPrismaClient } = require('../utils/database');

class MeetingService {
    constructor() {
        this.prisma = getPrismaClient();
    }

    async createMeeting(hostId, meetingData) {
        const { title, description, scheduledAt, settings } = meetingData;

        const meeting = await this.prisma.meeting.create({
            data: {
                title,
                description,
                hostId,
                organizationId: null, // Will be set based on user's organization
                scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
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
            this.prisma.meeting.findMany({
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
            this.prisma.meeting.count({
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
        const meeting = await this.prisma.meeting.findUnique({
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
        const meeting = await this.prisma.meeting.findUnique({
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

        const updatedMeeting = await this.prisma.meeting.update({
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
        const meeting = await this.prisma.meeting.findUnique({
            where: { id: meetingId }
        });

        if (!meeting) {
            throw new Error('MEETING_NOT_FOUND');
        }

        if (meeting.hostId !== hostId) {
            throw new Error('ACCESS_DENIED');
        }

        // Delete meeting (cascade will handle related records)
        await this.prisma.meeting.delete({
            where: { id: meetingId }
        });
    }

    async startMeeting(meetingId, hostId) {
        const meeting = await this.prisma.meeting.findUnique({
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

        const updatedMeeting = await this.prisma.meeting.update({
            where: { id: meetingId },
            data: {
                status: 'ACTIVE',
                startedAt: new Date()
            }
        });

        return updatedMeeting;
    }

    async endMeeting(meetingId, hostId) {
        const meeting = await this.prisma.meeting.findUnique({
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

        const updatedMeeting = await this.prisma.meeting.update({
            where: { id: meetingId },
            data: {
                status: 'ENDED',
                endedAt: new Date(),
                duration
            }
        });

        // Update all active participants to mark them as left
        await this.prisma.participant.updateMany({
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
}

module.exports = new MeetingService();