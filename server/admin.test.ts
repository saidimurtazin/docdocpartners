import { describe, it, expect, beforeAll } from 'vitest';
import { appRouter } from './routers';
import type { Context } from './_core/context';

describe('Admin API', () => {
  const mockAdminContext: Context = {
    user: {
      openId: 'test-admin',
      name: 'Test Admin',
      email: 'admin@test.com',
      role: 'admin',
    },
  };

  const mockUserContext: Context = {
    user: {
      openId: 'test-user',
      name: 'Test User',
      email: 'user@test.com',
      role: 'user',
    },
  };

  const mockNoAuthContext: Context = {
    user: null,
  };

  describe('checkAdmin', () => {
    it('should return true for admin user', async () => {
      const caller = appRouter.createCaller(mockAdminContext);
      const result = await caller.admin.checkAdmin();
      expect(result.isAdmin).toBe(true);
    });

    it('should throw error for non-admin user', async () => {
      const caller = appRouter.createCaller(mockUserContext);
      await expect(caller.admin.checkAdmin()).rejects.toThrow();
    });

    it('should throw error for unauthenticated user', async () => {
      const caller = appRouter.createCaller(mockNoAuthContext);
      await expect(caller.admin.checkAdmin()).rejects.toThrow();
    });
  });

  describe('statistics', () => {
    it('should return statistics for admin', async () => {
      const caller = appRouter.createCaller(mockAdminContext);
      const result = await caller.admin.statistics();
      
      expect(result).toHaveProperty('totalAgents');
      expect(result).toHaveProperty('activeAgents');
      expect(result).toHaveProperty('totalReferrals');
      expect(result).toHaveProperty('completedReferrals');
      expect(result).toHaveProperty('totalPaymentsAmount');
      expect(result).toHaveProperty('pendingPaymentsAmount');
      
      // Values might be bigint or number depending on database
      expect(['number', 'bigint', 'string']).toContain(typeof result.totalAgents);
      expect(['number', 'bigint', 'string']).toContain(typeof result.activeAgents);
      expect(['number', 'bigint', 'string']).toContain(typeof result.totalReferrals);
      expect(['number', 'bigint', 'string']).toContain(typeof result.completedReferrals);
      expect(['number', 'bigint', 'string']).toContain(typeof result.totalPaymentsAmount);
      expect(['number', 'bigint', 'string']).toContain(typeof result.pendingPaymentsAmount);
    });

    it('should throw error for non-admin user', async () => {
      const caller = appRouter.createCaller(mockUserContext);
      await expect(caller.admin.statistics()).rejects.toThrow();
    });
  });

  describe('agents', () => {
    it('should list agents for admin', async () => {
      const caller = appRouter.createCaller(mockAdminContext);
      const result = await caller.admin.agents.list();
      
      expect(Array.isArray(result)).toBe(true);
    });

    it('should throw error for non-admin user', async () => {
      const caller = appRouter.createCaller(mockUserContext);
      await expect(caller.admin.agents.list()).rejects.toThrow();
    });
  });

  describe('referrals', () => {
    it('should list referrals for admin', async () => {
      const caller = appRouter.createCaller(mockAdminContext);
      const result = await caller.admin.referrals.list();
      
      expect(Array.isArray(result)).toBe(true);
    });

    it('should throw error for non-admin user', async () => {
      const caller = appRouter.createCaller(mockUserContext);
      await expect(caller.admin.referrals.list()).rejects.toThrow();
    });
  });

  describe('payments', () => {
    it('should list payments for admin', async () => {
      const caller = appRouter.createCaller(mockAdminContext);
      const result = await caller.admin.payments.list();
      
      expect(Array.isArray(result)).toBe(true);
    });

    it('should throw error for non-admin user', async () => {
      const caller = appRouter.createCaller(mockUserContext);
      await expect(caller.admin.payments.list()).rejects.toThrow();
    });
  });

  describe('doctors', () => {
    it('should list doctors for admin', async () => {
      const caller = appRouter.createCaller(mockAdminContext);
      const result = await caller.admin.doctors.list();
      
      expect(Array.isArray(result)).toBe(true);
      
      // Check if sample doctors were added
      if (result.length > 0) {
        const doctor = result[0];
        expect(doctor).toHaveProperty('id');
        expect(doctor).toHaveProperty('fullName');
        expect(doctor).toHaveProperty('specialization');
        expect(doctor).toHaveProperty('clinic');
      }
    });

    it('should throw error for non-admin user', async () => {
      const caller = appRouter.createCaller(mockUserContext);
      await expect(caller.admin.doctors.list()).rejects.toThrow();
    });
  });
});
